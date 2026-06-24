import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, comparePassword, hashPassword, AUTH_COOKIE_NAME } from '@/lib/auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

export async function POST(request: NextRequest) {
  try {
    let token: string | undefined

    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }
    if (!token) {
      token = request.cookies.get(AUTH_COOKIE_NAME)?.value
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token is invalid or expired' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: payload.id } })
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    const hashedNewPassword = await hashPassword(newPassword)

    // Increment tokenVersion to invalidate all existing sessions
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword, tokenVersion: { increment: 1 } },
    })

    logAudit({
      userId: user.id,
      userName: user.email,
      userEmail: user.email,
      userRole: user.role,
      action: 'UPDATE',
      module: 'auth',
      details: { event: 'password_changed' },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}