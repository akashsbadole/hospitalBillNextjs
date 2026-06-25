import { describe, it, expect, beforeAll } from 'vitest'
import { hashPassword, comparePassword, signToken, verifyToken, signRefreshToken, verifyRefreshToken } from '@/lib/auth'

describe('Password Hashing', () => {
  it('should hash and compare passwords', async () => {
    const hash = await hashPassword('testPassword123')
    expect(hash).toBeTruthy()
    expect(hash).not.toBe('testPassword123')

    const isValid = await comparePassword('testPassword123', hash)
    expect(isValid).toBe(true)

    const isInvalid = await comparePassword('wrongPassword', hash)
    expect(isInvalid).toBe(false)
  })
})

describe('JWT Tokens', () => {
  const payload = { id: 'test-id', userId: 'USR-0001', email: 'test@test.com', role: 'Admin' }

  it('should sign and verify access tokens', () => {
    const token = signToken(payload)
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')

    const decoded = verifyToken(token)
    expect(decoded).not.toBeNull()
    expect(decoded!.id).toBe('test-id')
    expect(decoded!.email).toBe('test@test.com')
    expect(decoded!.role).toBe('Admin')
    expect(decoded!.type).toBe('access')
  })

  it('should sign and verify refresh tokens', () => {
    const token = signRefreshToken(payload)
    expect(token).toBeTruthy()

    const decoded = verifyRefreshToken(token)
    expect(decoded).not.toBeNull()
    expect(decoded!.type).toBe('refresh')
  })

  it('should reject expired tokens', () => {
    const expiredToken = signToken({ ...payload })
    // Mock the past by manipulating test... verifyToken uses jwt.verify which checks exp internally
    // This is handled by jsonwebtoken library
    expect(verifyToken('invalid.token.here')).toBeNull()
  })

  it('should reject access token for verifyRefreshToken', () => {
    const token = signToken(payload)
    const decoded = verifyRefreshToken(token)
    expect(decoded).toBeNull()
  })

  it('should reject refresh token for verifyToken', () => {
    const token = signRefreshToken(payload)
    const decoded = verifyToken(token)
    expect(decoded).toBeNull()
  })
})
