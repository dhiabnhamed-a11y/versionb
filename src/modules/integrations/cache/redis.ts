import Redis, { type RedisOptions } from 'ioredis'
import { logger } from '@/modules/shared/logger'

type RedisConnectionOptions = {
  host: string
  port: number
  username?: string
  password?: string
  db?: number
  tls?: Record<string, never>
  maxRetriesPerRequest?: number | null
}

const redisState = globalThis as typeof globalThis & {
  __taskitIntegrationRedis?: Redis | null
}

function redisUrl() {
  return process.env.INTEGRATIONS_REDIS_URL || process.env.REDIS_URL || process.env.QUEUE_REDIS_URL || ''
}

function parseRedisConnection(url: string): RedisConnectionOptions {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port || (parsed.protocol === 'rediss:' ? 6380 : 6379)),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) || undefined : undefined,
    maxRetriesPerRequest: 2,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  }
}

export function isIntegrationRedisConfigured() {
  return Boolean(redisUrl())
}

export function getIntegrationRedis() {
  if (!isIntegrationRedisConfigured()) return null
  if (redisState.__taskitIntegrationRedis !== undefined) return redisState.__taskitIntegrationRedis

  try {
    const redis = new Redis({
      ...(parseRedisConnection(redisUrl()) as RedisOptions),
      lazyConnect: true,
      enableAutoPipelining: true,
    } as RedisOptions)
    redis.on('error', (error) => logger.warn('integrations.redis_error', { error: error.message }))
    redisState.__taskitIntegrationRedis = redis
  } catch (error) {
    logger.warn('integrations.redis_init_failed', { error: error instanceof Error ? error.message : String(error) })
    redisState.__taskitIntegrationRedis = null
  }

  return redisState.__taskitIntegrationRedis
}
