import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createCipheriv, createHash, pbkdf2Sync } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import {
  decryptChromeCookieValue,
  parseCookieRows,
  readRowsFromDb,
  registrableDomain,
  toElectronCookie
} from './chrome-cookie-import'

const KEY = pbkdf2Sync('test-safe-storage', 'saltysalt', 1003, 16, 'sha1')

// Encrypt the way macOS Chrome does: `v10` + AES-128-CBC(IV=16 spaces), with the
// Chrome ≥127 SHA-256(host_key) prefix optionally prepended to the plaintext.
function encryptV10(value: string, hostKey: string, withDomainHash = true): Buffer {
  const iv = Buffer.alloc(16, 0x20)
  const cipher = createCipheriv('aes-128-cbc', KEY, iv)
  const prefix = withDomainHash ? createHash('sha256').update(hostKey).digest() : Buffer.alloc(0)
  const body = Buffer.concat([cipher.update(Buffer.concat([prefix, Buffer.from(value, 'utf8')])), cipher.final()])

  return Buffer.concat([Buffer.from('v10'), body])
}

test('decrypts a v10 cookie with the Chrome 127+ domain-hash prefix', () => {
  const enc = encryptV10('session=abc123; extra', '.bugcrowd.com', true)

  assert.equal(decryptChromeCookieValue(enc, KEY, '.bugcrowd.com'), 'session=abc123; extra')
})

test('decrypts a v10 cookie without the domain-hash prefix (older Chrome)', () => {
  const enc = encryptV10('plainvalue', '.example.com', false)

  assert.equal(decryptChromeCookieValue(enc, KEY, '.example.com'), 'plainvalue')
})

test('handles a value whose length is an exact AES block multiple (full PKCS7 block)', () => {
  const sixteen = '0123456789abcdef' // 16 bytes → a whole extra padding block
  const enc = encryptV10(sixteen, '.example.com', true)

  assert.equal(decryptChromeCookieValue(enc, KEY, '.example.com'), sixteen)
})

test('registrableDomain reduces subdomains to eTLD+1', () => {
  assert.equal(registrableDomain('login.hackers.bugcrowd.com'), 'bugcrowd.com')
  assert.equal(registrableDomain('bugcrowd.com'), 'bugcrowd.com')
  assert.equal(registrableDomain('localhost'), 'localhost')
})

test('parseCookieRows decodes hex-framed rows, including names with separators', () => {
  const hex = (value: string) => Buffer.from(value, 'utf8').toString('hex').toUpperCase()
  const line = [hex('.bugcrowd.com'), hex('odd|name\u001f'), '763130AB', hex('/'), 1, 0, 13_400_000_000_000_000, 2, 7].join('|')
  const rows = parseCookieRows(`${line}\n\nnot-a-row\n`)

  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], {
    hostKey: '.bugcrowd.com',
    name: 'odd|name\u001f',
    encryptedHex: '763130AB',
    path: '/',
    secure: true,
    httpOnly: false,
    expiresUtc: 13_400_000_000_000_000,
    sameSite: 2,
    lastUpdateUtc: 7
  })
})

// Regression: sqlite3 ≥3.50 prints control characters escaped (char(31) → "^_"),
// which made the old unit-separator framing drop every row. Run the real CLI.
test.skipIf(!fs.existsSync('/usr/bin/sqlite3'))('readRowsFromDb reads rows through the real sqlite3 CLI', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-cookie-test-'))
  const db = path.join(dir, 'Cookies')

  try {
    execFileSync('/usr/bin/sqlite3', [
      db,
      `CREATE TABLE cookies(host_key TEXT, name TEXT, encrypted_value BLOB, path TEXT, is_secure INT,
         is_httponly INT, expires_utc INT, samesite INT, last_update_utc INT);
       INSERT INTO cookies VALUES('bugcrowd.com','_bugcrowd_session',x'763130AA','/',1,1,0,1,5);
       INSERT INTO cookies VALUES('.identity.bugcrowd.com','csrf-token',x'763130BB','/',1,0,13400000000000000,2,6);
       INSERT INTO cookies VALUES('notbugcrowd.com','other',x'00','/',0,0,0,-1,1);`
    ])

    const rows = readRowsFromDb(db, 'bugcrowd.com')

    assert.deepEqual(
      rows.map(row => [row.hostKey, row.name, row.encryptedHex, row.httpOnly]),
      [
        ['bugcrowd.com', '_bugcrowd_session', '763130AA', true],
        ['.identity.bugcrowd.com', 'csrf-token', '763130BB', false]
      ]
    )
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('toElectronCookie keeps host-only cookies host-only and maps session/expiry', () => {
  const base = { encryptedHex: '', path: '/', secure: true, httpOnly: true, sameSite: 1, lastUpdateUtc: 0 }
  const hostOnly = toElectronCookie({ ...base, hostKey: 'bugcrowd.com', name: 's', expiresUtc: 0 }, 'v')
  const wide = toElectronCookie(
    { ...base, hostKey: '.bugcrowd.com', name: 'c', expiresUtc: 13_400_000_000_000_000, sameSite: -1 },
    'v'
  )

  assert.equal(hostOnly.url, 'https://bugcrowd.com/')
  assert.equal('domain' in hostOnly, false)
  assert.equal('expirationDate' in hostOnly, false)
  assert.equal(hostOnly.sameSite, 'lax')
  assert.equal(wide.domain, '.bugcrowd.com')
  assert.equal(wide.sameSite, 'unspecified')
  assert.equal(wide.expirationDate, 13_400_000_000 - 11_644_473_600)
})
