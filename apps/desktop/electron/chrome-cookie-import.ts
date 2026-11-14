import { execFileSync } from 'node:child_process'
import { createDecipheriv, createHash, pbkdf2Sync } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { Session } from 'electron'

/**
 * Import login from Chrome (macOS).
 *
 * Reads the user's OWN Google Chrome cookies for ONE site and injects them into
 * an Electron session, so a login completed in real Chrome — where passkeys /
 * Touch ID / the cross-device QR flow all work, but Electron can't — carries
 * into the in-app Browser. Everything stays local: the only side effect is a
 * one-time macOS Keychain prompt (reading Chrome's "Safe Storage" key needs the
 * user's approval, since this app is not Chrome).
 *
 * macOS Chrome encrypts each cookie value as `v10` + AES-128-CBC(PBKDF2(keychain
 * key, "saltysalt", 1003), IV=16 spaces); Chrome ≥127 also prepends a 32-byte
 * SHA-256(host_key) to the plaintext. Kept in its own module so the crypto is
 * isolated and unit-testable without the Electron runtime.
 */

const CHROME_USER_DATA_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Google',
  'Chrome'
)

// Profiles that never hold a user's real logins — skip them when scanning.
const NON_LOGIN_PROFILES = new Set(['System Profile', 'Guest Profile'])

export interface RawChromeCookie {
  hostKey: string
  name: string
  encryptedHex: string
  path: string
  secure: boolean
  httpOnly: boolean
  expiresUtc: number
  sameSite: number
  lastUpdateUtc: number
}

/** The host's registrable domain (naive eTLD+1: last two labels). */
export function registrableDomain(host: string): string {
  const labels = host.replace(/^\[|\]$/g, '').split('.').filter(Boolean)

  return labels.length <= 2 ? host : labels.slice(-2).join('.')
}

/** Read Chrome's "Safe Storage" AES password from the login Keychain. Prompts
 *  the user for access the first time. */
function chromeSafeStorageKey(): string {
  const out = execFileSync(
    '/usr/bin/security',
    ['find-generic-password', '-s', 'Chrome Safe Storage', '-a', 'Chrome', '-w'],
    { encoding: 'utf8', timeout: 120_000 }
  )

  return out.trim()
}

function deriveAesKey(password: string): Buffer {
  return pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')
}

/** Decrypt one `v10`/`v11` cookie value. Exported for tests. */
export function decryptChromeCookieValue(encrypted: Buffer, aesKey: Buffer, hostKey: string): string {
  if (encrypted.length === 0) {
    return ''
  }

  const prefix = encrypted.subarray(0, 3).toString('latin1')

  if (prefix !== 'v10' && prefix !== 'v11') {
    // Not encrypted (rare, older stores) — the value is stored as-is.
    return encrypted.toString('utf8')
  }

  const iv = Buffer.alloc(16, 0x20) // 16 spaces
  const decipher = createDecipheriv('aes-128-cbc', aesKey, iv)

  decipher.setAutoPadding(false)

  let plain = Buffer.concat([decipher.update(encrypted.subarray(3)), decipher.final()])

  // Strip PKCS#7 padding manually (setAutoPadding(false) above).
  const pad = plain[plain.length - 1]

  if (pad > 0 && pad <= 16 && pad <= plain.length) {
    plain = plain.subarray(0, plain.length - pad)
  }

  // Chrome ≥127 prepends SHA-256(host_key) to the plaintext to bind the value to
  // its cookie; drop it when present so we recover the real value.
  const domainHash = createHash('sha256').update(hostKey).digest()

  if (plain.length >= 32 && plain.subarray(0, 32).equals(domainHash)) {
    plain = plain.subarray(32)
  }

  return plain.toString('utf8')
}

/** Chrome profile directories that have a Cookies store, in on-disk order
 *  (Default first, then `Profile N`). System/Guest profiles are excluded. */
function listCookieProfiles(userDataDir = CHROME_USER_DATA_DIR): { name: string; cookiesDb: string }[] {
  let entries: string[]

  try {
    entries = fs.readdirSync(userDataDir)
  } catch {
    return []
  }

  const profiles: { name: string; cookiesDb: string }[] = []

  for (const name of entries) {
    if (NON_LOGIN_PROFILES.has(name)) {
      continue
    }

    if (name !== 'Default' && !name.startsWith('Profile ')) {
      continue
    }

    const cookiesDb = path.join(userDataDir, name, 'Cookies')

    if (fs.existsSync(cookiesDb)) {
      profiles.push({ name, cookiesDb })
    }
  }

  // Default before numbered profiles, numbered profiles in natural order.
  return profiles.sort((a, b) => {
    if (a.name === 'Default') {
      return -1
    }

    if (b.name === 'Default') {
      return 1
    }

    const na = Number(a.name.replace(/^Profile /, '')) || 0
    const nb = Number(b.name.replace(/^Profile /, '')) || 0

    return na - nb
  })
}

/**
 * SQL for one site's cookie rows. Every text column is hex-encoded and the
 * columns are joined with `|`, so the output is pure `[0-9A-F|]` no matter what
 * a cookie name/path contains — and no matter how the sqlite3 CLI renders
 * control characters (3.50+ prints them escaped, e.g. char(31) as a literal
 * `^_`, which silently broke the old unit-separator framing). Exported for tests.
 */
export function cookieRowQuery(domain: string): string {
  const safe = domain.replace(/'/g, "''")

  return (
    `SELECT hex(host_key)||'|'||hex(name)||'|'||hex(encrypted_value)||'|'||hex(path)||'|'||` +
    `is_secure||'|'||is_httponly||'|'||expires_utc||'|'||samesite||'|'||last_update_utc ` +
    `FROM cookies WHERE host_key='${safe}' OR host_key LIKE '%.${safe}'`
  )
}

/** Parse the sqlite3 output of {@link cookieRowQuery}. Exported for tests. */
export function parseCookieRows(out: string): RawChromeCookie[] {
  const rows: RawChromeCookie[] = []
  const text = (hex: string) => Buffer.from(hex, 'hex').toString('utf8')

  for (const line of out.split('\n')) {
    const parts = line.trim().split('|')

    if (parts.length < 9 || !parts[0]) {
      continue
    }

    rows.push({
      hostKey: text(parts[0]),
      name: text(parts[1]),
      encryptedHex: parts[2],
      path: text(parts[3]) || '/',
      secure: parts[4] === '1',
      httpOnly: parts[5] === '1',
      expiresUtc: Number(parts[6]) || 0,
      sameSite: Number(parts[7]),
      lastUpdateUtc: Number(parts[8]) || 0
    })
  }

  return rows
}

/** Read matching cookie rows from ONE profile's Cookies DB. Exported for tests. */
export function readRowsFromDb(cookiesDb: string, domain: string): RawChromeCookie[] {
  // Copy the DB (+WAL/SHM) so a running Chrome's lock can't block the read.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-chrome-cookies-'))
  const tmpDb = path.join(tmpDir, 'Cookies')

  try {
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(cookiesDb + suffix)) {
        fs.copyFileSync(cookiesDb + suffix, tmpDb + suffix)
      }
    }

    const out = execFileSync('/usr/bin/sqlite3', ['-readonly', tmpDb, cookieRowQuery(domain)], {
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 64 * 1024 * 1024
    })

    return parseCookieRows(out)
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      void 0
    }
  }
}

/**
 * Find the Chrome profile actually signed in to `domain` and return its rows.
 *
 * Users commonly have many profiles (and often no "Default" one), with the real
 * login in exactly one. Scan every profile, then pick the one with the most
 * matching cookies — the strongest signal of an active session — breaking ties
 * by most-recently-updated. Injecting from a single profile avoids colliding
 * cookies from two profiles signed in to the same site.
 */
function readChromeCookieRows(
  domain: string,
  userDataDir = CHROME_USER_DATA_DIR
): { profile: string; rows: RawChromeCookie[] } {
  const profiles = listCookieProfiles(userDataDir)

  if (profiles.length === 0) {
    throw new Error('Chrome cookie store not found — is Google Chrome installed?')
  }

  let best: { profile: string; rows: RawChromeCookie[]; recency: number } | null = null

  for (const profile of profiles) {
    let rows: RawChromeCookie[]

    try {
      rows = readRowsFromDb(profile.cookiesDb, domain)
    } catch {
      continue // unreadable profile — fall to the next rung
    }

    if (rows.length === 0) {
      continue
    }

    const recency = rows.reduce((max, row) => Math.max(max, row.lastUpdateUtc), 0)
    const better =
      !best || rows.length > best.rows.length || (rows.length === best.rows.length && recency > best.recency)

    if (better) {
      best = { profile: profile.name, rows, recency }
    }
  }

  if (!best) {
    throw new Error(`No Chrome profile is signed in to ${domain} — sign in to the site in Chrome first.`)
  }

  return { profile: best.profile, rows: best.rows }
}

const SAME_SITE: Record<number, 'lax' | 'no_restriction' | 'strict'> = {
  0: 'no_restriction',
  1: 'lax',
  2: 'strict'
}

/**
 * Map a Chrome row to Electron `cookies.set` details. A host_key without a
 * leading dot is a host-only cookie: omit `domain` so Electron keeps it
 * host-only (passing it would widen the cookie to every subdomain, and is
 * rejected outright for `__Host-` cookies). Exported for tests.
 */
export function toElectronCookie(row: RawChromeCookie, value: string): Electron.CookiesSetDetails {
  const bareHost = row.hostKey.replace(/^\./, '')

  return {
    url: `http${row.secure ? 's' : ''}://${bareHost}${row.path || '/'}`,
    name: row.name,
    value,
    ...(row.hostKey.startsWith('.') ? { domain: row.hostKey } : {}),
    path: row.path || '/',
    secure: row.secure,
    httpOnly: row.httpOnly,
    sameSite: SAME_SITE[row.sameSite] ?? 'unspecified',
    ...(row.expiresUtc > 0 ? { expirationDate: Math.floor(row.expiresUtc / 1_000_000 - 11_644_473_600) } : {})
  }
}

/**
 * Import every Chrome cookie for `host`'s registrable domain into `targetSession`.
 * Returns how many were set (and the domain used). Throws only on setup failures
 * (no Chrome, Keychain denied); individual bad cookies are skipped.
 */
export async function importChromeCookiesForHost(
  targetSession: Session,
  host: string
): Promise<{ domain: string; imported: number; profile: string }> {
  const domain = registrableDomain(host)
  const aesKey = deriveAesKey(chromeSafeStorageKey())
  const { profile, rows } = readChromeCookieRows(domain)
  let imported = 0

  for (const row of rows) {
    let value = ''

    try {
      value = decryptChromeCookieValue(Buffer.from(row.encryptedHex, 'hex'), aesKey, row.hostKey)
    } catch {
      continue
    }

    if (!value) {
      continue
    }

    try {
      await targetSession.cookies.set(toElectronCookie(row, value))
      imported++
    } catch (error) {
      // Electron rejects a few (bad secure/domain combos); keep importing the
      // rest, but say which so a "still logged out" report is diagnosable.
      console.warn(
        `[chrome-cookie-import] skipped ${row.name} @ ${row.hostKey}: ${error instanceof Error ? error.message : error}`
      )
    }
  }

  return { domain, imported, profile }
}
