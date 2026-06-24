import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createHash } from 'crypto'

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
})()

const TOKEN_EXPIRY_HOURS = 24
const REFRESH_TOKEN_EXPIRY_DAYS = 7

export interface TokenPayload {
  id: string
  userId: string
  email: string
  role: string
  tokenVersion?: number
  type?: 'access' | 'refresh'
}

function isLegacySha256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash)
}

function legacySha256Hash(password: string): string {
  const salt = process.env.LEGACY_PASSWORD_SALT || 'medibill-salt-2024'
  return createHash('sha256').update(password + salt).digest('hex')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (isLegacySha256Hash(hash)) {
    return legacySha256Hash(password) === hash
  }
  return bcrypt.compare(password, hash)
}

export function needsBcryptMigration(hash: string): boolean {
  return isLegacySha256Hash(hash)
}

export function signToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    JWT_SECRET,
    { expiresIn: `${TOKEN_EXPIRY_HOURS}h` }
  )
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload
    if (decoded.type !== 'access') return null
    return decoded
  } catch {
    return null
  }
}

export function signRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` }
  )
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload
    if (decoded.type !== 'refresh') return null
    return decoded
  } catch {
    return null
  }
}

export const AUTH_COOKIE_NAME = 'medibill_token'
export const REFRESH_COOKIE_NAME = 'medibill_refresh'

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TOKEN_EXPIRY_HOURS * 60 * 60,
  }
}

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
  }
}

export function getClearCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }
}
