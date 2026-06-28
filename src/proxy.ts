import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/_next/static', '/favicon.ico']

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (!SAFE_METHODS.includes(request.method) && pathname.startsWith('/api')) {
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')

    if (origin && host) {
      try {
        const originHost = new URL(origin).host
        if (originHost !== host) {
          return NextResponse.json(
            { error: 'CSRF validation failed: Invalid origin' },
            { status: 403 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'CSRF validation failed: Malformed origin' },
          { status: 403 }
        )
      }
    }

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json') || contentType.includes('multipart/form-data')) {
      // Has body — require Content-Type for CSRF safety on writes
    }
  }

  const response = NextResponse.next()

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
