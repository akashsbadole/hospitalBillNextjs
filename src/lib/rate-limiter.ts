import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const ipMap = new Map<string, RateLimitEntry>()
const GLOBAL_MAP_CLEANUP_INTERVAL = 60_000

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of ipMap) {
    if (now > entry.resetAt) {
      ipMap.delete(key)
    }
  }
}, GLOBAL_MAP_CLEANUP_INTERVAL)

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
}

export function rateLimit(
  request: Request,
  config: Partial<RateLimitConfig> = {}
): { ok: true } | { ok: false; response: NextResponse } {
  const { windowMs, maxRequests } = { ...DEFAULT_CONFIG, ...config }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  const now = Date.now()
  const entry = ipMap.get(ip)

  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Too many requests. Please try again in ${retryAfter} seconds.` },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
          },
        }
      ),
    }
  }

  entry.count++
  return { ok: true }
}

export function createRateLimiter(config: Partial<RateLimitConfig>) {
  return (request: Request) => rateLimit(request, config)
}

export const strictRateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 5 })
export const moderateRateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 20 })
export const standardRateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 60 })
