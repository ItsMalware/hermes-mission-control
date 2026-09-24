/**
 * Headless CLI chat bridge. Runs `claude` / `codex` in non-interactive mode so
 * the renderer can wrap them in a normal chat box instead of a terminal.
 *
 * Auto-approve is intentional (user opted in): claude runs with
 * `--dangerously-skip-permissions`, codex with
 * `--dangerously-bypass-approvals-and-sandbox`. Session continuity is preserved
 * by threading the CLI's own session id back on each turn.
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { app, ipcMain } from 'electron'

type CliId = 'claude' | 'codex'

interface CliChatRequest {
  cli: CliId
  message: string
  sessionId?: string | null
  cwd?: string | null
}

interface CliChatResult {
  ok: boolean
  text: string
  sessionId: string | null
  error?: string
}

const RUN_TIMEOUT_MS = 10 * 60 * 1000
const MAX_BUFFER = 32 * 1024 * 1024

// GUI-launched apps inherit a minimal PATH that misses Homebrew / user installs,
// so the CLI binaries aren't found. Enrich it with the usual suspects.
function enrichedPath(): string {
  const home = app.getPath('home')
  const extra = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    path.join(home, '.local', 'bin'),
    path.join(home, '.hermes', 'node', 'bin'),
    path.join(home, '.npm-global', 'bin')
  ]
  const current = (process.env.PATH || '').split(':').filter(Boolean)
  return [...new Set([...extra, ...current])].join(':')
}

function resolveBinary(cli: CliId): string {
  const candidates = [
    `/opt/homebrew/bin/${cli}`,
    `/usr/local/bin/${cli}`,
    path.join(app.getPath('home'), '.local', 'bin', cli)
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return cli // fall back to PATH lookup (enriched below)
}

function run(bin: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise(resolve => {
    execFile(
      bin,
      args,
      { cwd, timeout: RUN_TIMEOUT_MS, maxBuffer: MAX_BUFFER, env: { ...process.env, PATH: enrichedPath() } },
      (err, stdout, stderr) => {
        const code = err && typeof (err as { code?: unknown }).code === 'number' ? (err as { code: number }).code : err ? 1 : 0
        resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), code })
      }
    )
  })
}

/** claude -p --output-format json emits one JSON object: { result, session_id }. */
function parseClaude(stdout: string): { text: string; sessionId: string | null } {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(stdout.slice(start, end + 1)) as { result?: string; session_id?: string }
      return { text: (obj.result ?? '').trim(), sessionId: obj.session_id ?? null }
    } catch {
      /* fall through to raw */
    }
  }
  return { text: stdout.trim(), sessionId: null }
}

/** codex exec --json emits JSONL events; collect agent text + thread/session id. */
function parseCodex(stdout: string): { text: string; sessionId: string | null } {
  let sessionId: string | null = null
  const parts: string[] = []
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    let evt: Record<string, unknown>
    try {
      evt = JSON.parse(trimmed)
    } catch {
      continue
    }
    const id = (evt.session_id || evt.thread_id || evt.conversation_id) as string | undefined
    if (id) sessionId = id
    const item = (evt.item ?? evt.msg ?? evt) as Record<string, unknown>
    const type = String(item.type ?? evt.type ?? '')
    if (type.includes('agent_message') || type === 'message' || type.includes('assistant')) {
      const text = (item.text ?? item.message ?? item.content) as unknown
      if (typeof text === 'string' && text.trim()) parts.push(text.trim())
    }
  }
  const text = parts.length ? parts[parts.length - 1] : stdout.trim()
  return { text, sessionId }
}

async function handle(req: CliChatRequest): Promise<CliChatResult> {
  const message = String(req.message ?? '').trim()
  if (!message) {
    return { ok: false, text: '', sessionId: null, error: 'empty message' }
  }
  const cli = req.cli === 'codex' ? 'codex' : 'claude'
  const cwd = req.cwd && existsSync(String(req.cwd)) ? String(req.cwd) : app.getPath('home')
  const bin = resolveBinary(cli)
  const sessionId = req.sessionId ? String(req.sessionId) : ''

  let args: string[]
  if (cli === 'claude') {
    args = ['-p', message, '--output-format', 'json', '--dangerously-skip-permissions']
    if (sessionId) args.splice(2, 0, '--resume', sessionId)
  } else {
    const flags = ['--json', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', '--color', 'never']
    args = sessionId
      ? ['exec', 'resume', sessionId, ...flags, message]
      : ['exec', ...flags, message]
  }

  const { stdout, stderr, code } = await run(bin, args, cwd)
  const parsed = cli === 'claude' ? parseClaude(stdout) : parseCodex(stdout)

  if (!parsed.text && code !== 0) {
    const detail = stderr.trim() || stdout.trim() || `exited with code ${code}`
    return { ok: false, text: '', sessionId: parsed.sessionId ?? sessionId ?? null, error: detail.slice(0, 600) }
  }

  return { ok: true, text: parsed.text, sessionId: parsed.sessionId ?? (sessionId || null) }
}

let registered = false

export function registerCliChatIpc(): void {
  if (registered) return
  registered = true
  ipcMain.handle('hermes:cliChat:send', async (_event, req: CliChatRequest) => {
    try {
      return await handle(req)
    } catch (error) {
      return { ok: false, text: '', sessionId: null, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
