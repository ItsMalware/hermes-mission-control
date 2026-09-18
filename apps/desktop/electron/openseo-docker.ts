// Boot-time ensure for the OpenSEO Docker container.
//
// The Self → OpenSEO tab iframes the OpenSEO web UI at http://127.0.0.1:3001,
// served by a Docker container. When Docker Desktop isn't running (fresh
// login, user quit it) the iframe hard-fails with ERR_SOCKET_NOT_CONNECTED and
// the tab stays dead until someone starts the stack by hand.
//
// This module is best-effort and never blocks app start: every probe is
// bounded, every failure is logged and terminal — the tab's own Retry button
// is the user-facing recovery affordance. The ladder (per AGENTS.md):
//
//   1. Docker CLI present?            (else: log + stop)
//   2. Daemon answering?              (else: launch Docker Desktop, bounded poll)
//   3. Container exists / running?    (docker inspect)
//   4. Prefer the compose project when a compose file is on disk (heals
//      config drift), fall back to `docker start`, last resort `docker run`.
//   5. Verify the leg we actually use: TCP connect to 127.0.0.1:3001.

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import { promisify } from 'node:util'

export const OPENSEO_CONTAINER = 'open-seo-open-seo-1'
export const OPENSEO_IMAGE = 'ghcr.io/every-app/open-seo:latest'
export const OPENSEO_HOST_PORT = 3001

/** Machine-specific default; override with HERMES_DESKTOP_OPENSEO_COMPOSE. */
export const DEFAULT_COMPOSE_FILE = '/Users/yaz_malware_honeypot/open-seo/compose.yaml'

const EXEC_TIMEOUT_MS = 15_000
const DAEMON_POLL_INTERVAL_MS = 3_000
const DAEMON_POLL_ATTEMPTS = 20 // ≈60s for Docker Desktop to come up
const PORT_POLL_INTERVAL_MS = 1_000
const PORT_POLL_ATTEMPTS = 30 // ≈30s for the server to bind after start

const execFileAsync = promisify(execFile)

/** argv for creating the container from scratch — mirrors the compose
 *  project's published port and restart policy. */
export function dockerRunArgv(): string[] {
  return [
    'run',
    '-d',
    '--name',
    OPENSEO_CONTAINER,
    '--restart',
    'unless-stopped',
    '-p',
    `127.0.0.1:${OPENSEO_HOST_PORT}:3001`,
    OPENSEO_IMAGE
  ]
}

/** Pull the compose file path out of `docker inspect` labels so we can heal
 *  through the owning compose project instead of hardcoding its location. */
export function composeFileFromLabels(labels: unknown): string | null {
  if (!labels || typeof labels !== 'object') {
    return null
  }

  const file = (labels as Record<string, unknown>)['com.docker.compose.project.config_files']

  return typeof file === 'string' && file.length > 0 ? file : null
}

export type ContainerEnsure =
  /** Already running — nothing to do. */
  | { kind: 'none' }
  /** Bring the owning compose project up (handles stopped AND missing). */
  | { kind: 'compose-up'; composeFile: string }
  /** Plain `docker start` for a stopped container with no compose file. */
  | { kind: 'start' }
  /** Create from the image — last resort, loses any compose-only config. */
  | { kind: 'run' }

/** The container ladder as a pure decision: compose heals first, then a bare
 *  start, then a from-scratch run. `composeFile` must already be verified on
 *  disk by the caller. */
export function decideContainerEnsure(state: {
  containerExists: boolean
  containerRunning: boolean
  composeFile: string | null
}): ContainerEnsure {
  if (state.containerRunning) {
    return { kind: 'none' }
  }

  if (state.composeFile) {
    return { kind: 'compose-up', composeFile: state.composeFile }
  }

  if (state.containerExists) {
    return { kind: 'start' }
  }

  return { kind: 'run' }
}

interface DockerState {
  containerExists: boolean
  containerRunning: boolean
  composeFile: string | null
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function docker(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('docker', args, { timeout: EXEC_TIMEOUT_MS })

  return stdout
}

/** 'up' — daemon answers; 'down' — CLI works but daemon doesn't; 'no-cli'. */
async function probeDaemon(): Promise<'up' | 'down' | 'no-cli'> {
  try {
    await docker('info', '--format', '{{.ServerVersion}}')

    return 'up'
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'no-cli' : 'down'
  }
}

async function readDockerState(env: NodeJS.ProcessEnv): Promise<DockerState> {
  let inspect: string

  try {
    inspect = await docker('inspect', OPENSEO_CONTAINER)
  } catch {
    // No such container (or unparseable) — treat as missing.
    return { containerExists: false, containerRunning: false, composeFile: onDiskComposeFile(env, null) }
  }

  let parsed: { State?: { Running?: boolean }; Config?: { Labels?: unknown } } | null = null

  try {
    const arr = JSON.parse(inspect) as unknown

    parsed = Array.isArray(arr) && arr.length > 0 ? (arr[0] as typeof parsed) : null
  } catch {
    parsed = null
  }

  const composeFile = onDiskComposeFile(env, composeFileFromLabels(parsed?.Config?.Labels))

  return {
    containerExists: true,
    containerRunning: parsed?.State?.Running === true,
    composeFile
  }
}

/** First compose-file candidate that actually exists on disk: env override,
 *  the container's own label, then the machine default. */
function onDiskComposeFile(env: NodeJS.ProcessEnv, fromLabels: string | null): string | null {
  const candidates = [env.HERMES_DESKTOP_OPENSEO_COMPOSE, fromLabels, DEFAULT_COMPOSE_FILE]

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function portOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port })
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }

    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(PORT_POLL_INTERVAL_MS, () => done(false))
  })
}

/**
 * Best-effort: ensure the OpenSEO container is running. Never throws, never
 * blocks boot — call fire-and-forget from app.whenReady().
 */
export async function ensureOpenSeoContainer({
  log,
  env = process.env,
  platform = process.platform
}: {
  log: (line: string) => void
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform | string
}): Promise<void> {
  const tag = '[openseo]'

  try {
    let daemon = await probeDaemon()

    if (daemon === 'no-cli') {
      log(`${tag} docker CLI not found — OpenSEO tab will stay offline until Docker is installed`)

      return
    }

    if (daemon === 'down') {
      if (platform !== 'darwin') {
        log(`${tag} docker daemon is down and auto-launch is only wired for macOS — start Docker manually`)

        return
      }

      log(`${tag} docker daemon is down — launching Docker Desktop`)
      await execFileAsync('open', ['-a', 'Docker'], { timeout: EXEC_TIMEOUT_MS }).catch(error => {
        log(`${tag} could not launch Docker Desktop: ${error instanceof Error ? error.message : String(error)}`)
      })

      for (let attempt = 0; attempt < DAEMON_POLL_ATTEMPTS && daemon === 'down'; attempt += 1) {
        await sleep(DAEMON_POLL_INTERVAL_MS)
        daemon = await probeDaemon()
      }

      if (daemon !== 'up') {
        log(`${tag} docker daemon did not come up in ${(DAEMON_POLL_ATTEMPTS * DAEMON_POLL_INTERVAL_MS) / 1000}s — giving up (use the tab's Retry)`)

        return
      }
    }

    const state = await readDockerState(env)
    let action = decideContainerEnsure(state)

    if (action.kind === 'none') {
      log(`${tag} container ${OPENSEO_CONTAINER} already running`)
    } else {
      log(`${tag} ensuring container via ${action.kind}`)

      try {
        if (action.kind === 'compose-up') {
          await docker('compose', '-f', action.composeFile, 'up', '-d')
        } else if (action.kind === 'start') {
          await docker('start', OPENSEO_CONTAINER)
        } else {
          await docker(...dockerRunArgv())
        }
      } catch (error) {
        // A failed compose rung falls to the next one rather than surfacing.
        if (action.kind === 'compose-up') {
          log(`${tag} compose up failed (${error instanceof Error ? error.message : String(error)}) — falling back`)

          action = decideContainerEnsure({ ...state, composeFile: null })

          if (action.kind === 'start') {
            await docker('start', OPENSEO_CONTAINER)
          } else if (action.kind === 'run') {
            await docker(...dockerRunArgv())
          }
        } else {
          throw error
        }
      }
    }

    // Verify the leg the tab actually uses — the TCP listener, not container
    // state. Bounded; the tab's Retry is the recovery affordance past this.
    for (let attempt = 0; attempt < PORT_POLL_ATTEMPTS; attempt += 1) {
      if (await portOpen(OPENSEO_HOST_PORT)) {
        log(`${tag} OpenSEO is reachable at http://127.0.0.1:${OPENSEO_HOST_PORT}`)

        return
      }

      await sleep(PORT_POLL_INTERVAL_MS)
    }

    log(`${tag} container started but 127.0.0.1:${OPENSEO_HOST_PORT} never accepted a connection — giving up`)
  } catch (error) {
    log(`${tag} ensure failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
