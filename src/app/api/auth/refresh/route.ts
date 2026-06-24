import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  verifyRefreshToken,
  signToken,
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearCookieOptions,
} from '@/lib/auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

export async function POST(request: NextRequest) {
  try {
    // Read refresh token from httpOnly cookie first, then fall back to body
    let refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value

    if (!refreshToken) {
      try {
        const body = await request.json()
        refreshToken = body.refreshToken
      } catch {
        // Body may be empty
      }
    }

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token not found' },
        { status: 401 }
      )
    }

    const payload = verifyRefreshToken(refreshToken)
    if (!payload) {
      // Clear the invalid refresh cookie
      const response = NextResponse.json(
        { error: 'Refresh token is invalid or expired' },
        { status: 401 }
      )
      response.cookies.set(REFRESH_COOKIE_NAME, '', getClearCookieOptions())
      response.cookies.set(AUTH_COOKIE_NAME, '', getClearCookieOptions())
      return response
    }

    // Check user still exists and is Active
    const user = await db.user.findUnique({
      where: { id: payload.id },
    })

    if (!user || user.status !== 'Active') {
      const response = NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 401 }
      )
      response.cookies.set(REFRESH_COOKIE_NAME, '', getClearCookieOptions())
      response.cookies.set(AUTH_COOKIE_NAME, '', getClearCookieOptions())
      return response
    }

    // Sign new access token
    const tokenPayload = {
      id: user.id,
      userId: user.userId,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    }
    const newAccessToken = signToken(tokenPayload)

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
      token: newAccessToken,
    })

    // Set new access token cookie
    response.cookies.set(AUTH_COOKIE_NAME, newAccessToken, getAuthCookieOptions())

    logAudit({
      userId: user.id,
      userName: user.email,
      userEmail: user.email,
      userRole: user.role,
      action: 'LOGIN',
      module: 'auth',
      details: { event: 'token_refreshed' },
      ...extractRequestInfo(request),
    })

    return response
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}