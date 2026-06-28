import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit, strictRateLimit, moderateRateLimit, standardRateLimit } from '@/lib/rate-limiter'

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function makeRequest(ip: string = '1.2.3.4'): Request {
    return new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': ip },
    }) as Request
  }

  it('should allow requests within limit', () => {
    const limiter = (req: Request) => rateLimit(req, { windowMs: 60000, maxRequests: 5 })

    for (let i = 0; i < 5; i++) {
      const result = limiter(makeRequest())
      expect(result.ok).toBe(true)
    }
  })

  it('should block requests over limit', () => {
    const limiter = (req: Request) => rateLimit(req, { windowMs: 60000, maxRequests: 3 })
    const req = makeRequest('5.6.7.8')

    limiter(req)
    limiter(req)
    limiter(req)
    const result = limiter(req)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(429)
    }
  })

  it('should track different IPs separately', () => {
    const limiter = (req: Request) => rateLimit(req, { windowMs: 60000, maxRequests: 2 })
    const req1 = makeRequest('10.0.0.1')
    const req2 = makeRequest('10.0.0.2')

    limiter(req1)
    limiter(req1)
    const r1 = limiter(req1)
    expect(r1.ok).toBe(false)

    const r2 = limiter(req2)
    expect(r2.ok).toBe(true)
  })

  it('should reset after window expires', () => {
    const limiter = (req: Request) => rateLimit(req, { windowMs: 1000, maxRequests: 1 })
    const req = makeRequest('11.11.11.11')

    limiter(req)
    const r1 = limiter(req)
    expect(r1.ok).toBe(false)

    vi.advanceTimersByTime(1100)
    const r2 = limiter(req)
    expect(r2.ok).toBe(true)
  })

  describe('Pre-configured limiters', () => {
    it('strictRateLimit should exist and be callable', () => {
      expect(typeof strictRateLimit).toBe('function')
      const result = strictRateLimit(makeRequest('1.1.1.1'))
      expect(result.ok).toBe(true)
    })

    it('moderateRateLimit should exist and be callable', () => {
      expect(typeof moderateRateLimit).toBe('function')
      const result = moderateRateLimit(makeRequest('2.2.2.2'))
      expect(result.ok).toBe(true)
    })

    it('standardRateLimit should exist and be callable', () => {
      expect(typeof standardRateLimit).toBe('function')
      const result = standardRateLimit(makeRequest('3.3.3.3'))
      expect(result.ok).toBe(true)
    })
  })
})
