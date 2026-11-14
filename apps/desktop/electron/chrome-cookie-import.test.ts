import assert from 'node:assert/strict'
import { createCipheriv, createHash, pbkdf2Sync } from 'node:crypto'

import { test } from 'vitest'

import { decryptChromeCookieValue, registrableDomain } from './chrome-cookie-import'

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
