import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  comparePassword,
  hashPassword,
  needsBcryptMigration,
  signToken,
  signRefreshToken,
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  getAuthCookieOptions,
  getRefreshCookieOptions,
} from '@/lib/auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { strictRateLimit } from '@/lib/rate-limiter'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = strictRateLimit(request)
    if (!rateLimitResult.ok) {
      return rateLimitResult.response
    }

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (user.status !== 'Active') {
      return NextResponse.json(
        { error: 'Account is inactive. Please contact administrator.' },
        { status: 401 }
      )
    }

    const isPasswordValid = await comparePassword(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Auto-migrate legacy SHA-256 hash to bcrypt
    if (needsBcryptMigration(user.password)) {
      const bcryptHash = await hashPassword(password)
      await db.user.update({
        where: { id: user.id },
        data: { password: bcryptHash },
      })
    }

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    const tokenPayload = {
      id: user.id,
      userId: user.userId,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    }

    const token = signToken(tokenPayload)
    const refreshToken = signRefreshToken(tokenPayload)

    const response = NextResponse.json({
      user: {
        id: user.id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
      },
      token,
    })

    response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions())
    response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions())

    logAudit({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'LOGIN',
      module: 'auth',
      details: { email: user.email },
      ...extractRequestInfo(request),
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}