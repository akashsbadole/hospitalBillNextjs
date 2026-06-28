import { describe, it, expect, beforeEach } from 'vitest'
import { encrypt, decrypt, reEncryptWithCurrentKey } from '@/lib/crypto'

describe('Crypto - AES Encryption', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-1234'
  })

  it('should encrypt and decrypt text round-trip', () => {
    const plaintext = 'Hello, MediBill!'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toMatch(/^v\d+:[a-f0-9]+:[a-f0-9]+$/)

    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('should encrypt empty string', () => {
    const encrypted = encrypt('')
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe('')
  })

  it('should produce different ciphertext for same input (random IV)', () => {
    const plaintext = 'Same message twice'
    const enc1 = encrypt(plaintext)
    const enc2 = encrypt(plaintext)
    expect(enc1).not.toBe(enc2)
    expect(decrypt(enc1)).toBe(plaintext)
    expect(decrypt(enc2)).toBe(plaintext)
  })

  it('should throw on invalid ciphertext format', () => {
    expect(() => decrypt('garbage')).toThrow()
  })

  it('should throw on empty ciphertext', () => {
    expect(() => decrypt('')).toThrow()
  })

  it('should re-encrypt with current key', async () => {
    const plaintext = 'Sensitive data'
    const encrypted = encrypt(plaintext)
    const reEncrypted = await reEncryptWithCurrentKey(encrypted)
    expect(reEncrypted).not.toBe(encrypted)
    expect(decrypt(reEncrypted)).toBe(plaintext)
  })
})
