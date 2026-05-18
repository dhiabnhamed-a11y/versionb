import { rateLimitRequest, type RateLimitOptions, type RateLimitResult } from '@/modules/shared/rate-limit'
import { redisRateLimit } from '@/lib/rate-limit/redis'
import { logger } from '@/modules/shared/logger'

export type { RateLimitOptions, RateLimitResult }

export function enforceRateLimit(req: Request, options: RateLimitOptions): RateLimitResult {
  return rateLimitRequest(req, options)
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return req.headers.get('cf-connecting-ip')?.trim() || req.headers.get('x-real-ip')?.trim() || forwarded || 'unknown'
}

export async function enforceDistributedRateLimit(req: Request, options: RateLimitOptions): Promise<RateLimitResult> {
  const key = options.key || getClientIp(req)
  const redisResult = await redisRateLimit(key, options).catch(() => null)
  if (!redisResult && process.env.NODE_ENV === 'production') {
    logger.warn('rate_limit.redis_unavailable', { namespace: options.namespace })
  }
  return redisResult ?? rateLimitRequest(req, options)
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfterSeconds) }),
  }
}
