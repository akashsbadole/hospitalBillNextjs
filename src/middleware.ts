import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that do NOT require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/health',
]

// Pages that do NOT require authentication
const PUBLIC_PAGES = [
  '/',
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
}

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.some((page) => pathname === page)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for public routes, static files, and Next.js internals
  if (
    isPublicRoute(pathname) ||
    isPublicPage(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // static files (favicon.ico, logo.png, etc.)
  ) {
    return NextResponse.next()
  }

  // Check for auth token in cookies or Authorization header
  const token = request.cookies.get('medibill_token')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    // API routes: return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    // Pages: redirect to login
    const loginUrl = new URL('/', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // CSRF protection: verify origin for state-changing API methods
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    const method = request.method.toUpperCase()
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const origin = request.headers.get('origin')
      const host = request.headers.get('host')

      // Allow requests with no origin (mobile apps, curl, etc.)
      if (origin && host) {
        const originUrl = new URL(origin)
        if (originUrl.host !== host) {
          return NextResponse.json(
            { error: 'CSRF validation failed' },
            { status: 403 }
          )
        }
      }
    }
  }

  // Security headers for all responses
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|android-chrome-*.png|logo.png|site.webmanifest|robots.txt).*)',
  ],
}
