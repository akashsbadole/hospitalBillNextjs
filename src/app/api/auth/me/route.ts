import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, AUTH_COOKIE_NAME } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    let token: string | undefined

    // Check Authorization header first
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }

    // Fall back to cookie
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

    const user = await db.user.findUnique({
      where: { id: payload.id },
    })

    if (!user || user.status !== 'Active') {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
