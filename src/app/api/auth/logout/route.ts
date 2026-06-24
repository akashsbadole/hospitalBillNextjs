import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { AUTH_COOKIE_NAME, REFRESH_COOKIE_NAME, getClearCookieOptions, verifyToken } from '@/lib/auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

export async function POST(request: NextRequest) {
  // Try to get user info for audit logging
  try {
    const authHeader = request.headers.get('authorization')
    const cookieStore = await cookies()
    const token = authHeader?.replace('Bearer ', '') || cookieStore.get('medibill_token')?.value
    if (token) {
      const payload = verifyToken(token)
      if (payload) {
        logAudit({
          userId: payload.id,
          userName: '', // We don't have name in token, that's OK
          userEmail: payload.email,
          userRole: payload.role,
          action: 'LOGOUT',
          module: 'auth',
          ...extractRequestInfo(request),
        })
      }
    }
  } catch { /* silent */ }

  const response = NextResponse.json({ message: 'Logged out successfully' })
  response.cookies.set(AUTH_COOKIE_NAME, '', getClearCookieOptions())
  response.cookies.set(REFRESH_COOKIE_NAME, '', getClearCookieOptions())
  return response
}