import { getSharedRedis } from '@/lib/infra/redis-shared'
import type { RateLimitOptions, RateLimitResult } from '@/modules/shared/rate-limit'

function getRedis() {
  return getSharedRedis()
}

export async function redisRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult | null> {
  const client = getRedis()
  if (!client) return null

  try {
    const bucketKey = `rl:${options.namespace}:${key}`
    const count = await client.incr(bucketKey)
    if (count === 1) await client.pexpire(bucketKey, options.windowMs)
    const ttl = await client.pttl(bucketKey)
    const resetAt = Date.now() + Math.max(ttl, 0)
    const remaining = Math.max(options.max - count, 0)

    return {
      allowed: count <= options.max,
      remaining,
      resetAt,
      retryAfterSeconds: Math.max(Math.ceil(Math.max(ttl, 0) / 1000), 1),
    }
  } catch {
    return null
  }
}
