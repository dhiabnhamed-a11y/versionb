import Redis from 'ioredis'
import type { RateLimitOptions, RateLimitResult } from '@/modules/shared/rate-limit'

let redis: Redis | null | undefined

function getRedis() {
  if (redis !== undefined) return redis
  const url = process.env.REDIS_URL
  redis = url
    ? new Redis(url, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 5_000,
        commandTimeout: 3_000,
        lazyConnect: true,
      })
    : null
  return redis
}

export async function redisRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult | null> {
  const client = getRedis()
  if (!client) return null

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
}
