import { API_RATE_LIMITS } from '@/lib/api-defaults'
import type { RateLimitOptions } from '@/modules/shared/rate-limit'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function defaultRateLimitForRequest(req: Request): RateLimitOptions {
  const method = req.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD') return API_RATE_LIMITS.read
  const pathname = new URL(req.url).pathname
  if (pathname.startsWith('/api/ai')) return API_RATE_LIMITS.ai
  if (pathname.startsWith('/api/auth')) return API_RATE_LIMITS.auth
  return API_RATE_LIMITS.write
}

function expectedAppOrigin() {
  const expected = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '')
  if (!expected) return null
  try {
    return new URL(expected).origin
  } catch {
    return null
  }
}

function originFromReferer(referer: string | null) {
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

export function assertSafeApiOrigin(req: Request) {
  if (!MUTATION_METHODS.has(req.method.toUpperCase())) return
  if (process.env.NODE_ENV !== 'production') return

  const expectedOrigin = expectedAppOrigin()
  if (!expectedOrigin) return

  const origin = req.headers.get('origin') ?? originFromReferer(req.headers.get('referer'))
  if (!origin) {
    throw {
      code: 'MISSING_ORIGIN',
      expose: true,
      message: 'Origin header required for mutations.',
      status: 403,
    }
  }

  let actualOrigin: string
  try {
    actualOrigin = new URL(origin).origin
  } catch {
    throw {
      code: 'INVALID_ORIGIN',
      expose: true,
      message: 'Cross-origin mutation blocked.',
      status: 403,
    }
  }

  if (expectedOrigin !== actualOrigin) {
    throw {
      code: 'INVALID_ORIGIN',
      expose: true,
      message: 'Cross-origin mutation blocked.',
      status: 403,
    }
  }
}
