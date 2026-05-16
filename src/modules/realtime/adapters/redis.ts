import Redis, { type RedisOptions } from 'ioredis'
import type { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { Emitter } from '@socket.io/redis-emitter'
import { logger } from '@/modules/shared/logger'

export type RedisConnectionOptions = {
  host: string
  port: number
  username?: string
  password?: string
  db?: number
  tls?: Record<string, never>
  connectTimeout?: number
  enableOfflineQueue?: boolean
  maxRetriesPerRequest?: number | null
}

const realtimeRedisState = globalThis as typeof globalThis & {
  __taskitRealtimeRedis?: Redis | null
  __taskitRealtimeEmitterRedis?: Redis | null
  __taskitRealtimeEmitter?: Emitter | null
}

export function getRealtimeRedisUrl() {
  return process.env.REALTIME_REDIS_URL || process.env.REDIS_URL || process.env.QUEUE_REDIS_URL || ''
}

export function isRealtimeRedisConfigured() {
  return Boolean(getRealtimeRedisUrl())
}

export function isRealtimeRedisRequired() {
  return process.env.NODE_ENV === 'production'
}

export function parseRedisConnection(url: string): RedisConnectionOptions {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port || (parsed.protocol === 'rediss:' ? 6380 : 6379)),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) || undefined : undefined,
    connectTimeout: Math.max(Number(process.env.REALTIME_REDIS_CONNECT_TIMEOUT_MS ?? 2_500), 500),
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  }
}

export function createRealtimeRedisClient(name: string, options: Partial<RedisOptions> = {}) {
  const url = getRealtimeRedisUrl()
  if (!url) return null

  const redis = new Redis({
    ...(parseRedisConnection(url) as RedisOptions),
    connectionName: `taskit:${name}`,
    retryStrategy(times) {
      return Math.min(times * 250, 5_000)
    },
    reconnectOnError(error) {
      return /READONLY|ETIMEDOUT|ECONNRESET/i.test(error.message)
    },
    ...options,
  } as RedisOptions)

  redis.on('connect', () => logger.info('realtime.redis_connected', { name }))
  redis.on('ready', () => logger.info('realtime.redis_ready', { name }))
  redis.on('reconnecting', () => logger.warn('realtime.redis_reconnecting', { name }))
  redis.on('end', () => logger.warn('realtime.redis_disconnected', { name }))
  redis.on('error', (error) => logger.error('realtime.redis_error', error, { name }))

  return redis
}

export function getRealtimeRedis() {
  if (!isRealtimeRedisConfigured()) return null
  if (realtimeRedisState.__taskitRealtimeRedis !== undefined) return realtimeRedisState.__taskitRealtimeRedis

  realtimeRedisState.__taskitRealtimeRedis = createRealtimeRedisClient('state')
  return realtimeRedisState.__taskitRealtimeRedis
}

export async function verifyRealtimeRedisConnection() {
  if (!isRealtimeRedisConfigured()) return false

  const redis = createRealtimeRedisClient('startup-check', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  })
  if (!redis) return false

  try {
    await redis.connect()
    await redis.ping()
    return true
  } catch (error) {
    logger.error('realtime.redis_startup_check_failed', error)
    return false
  } finally {
    redis.disconnect()
  }
}

export async function assertRealtimeRedisReadyForProduction() {
  if (!isRealtimeRedisRequired()) return
  if (!(await verifyRealtimeRedisConnection())) {
    throw new Error('Realtime Redis is required in production. Set REALTIME_REDIS_URL, REDIS_URL, or QUEUE_REDIS_URL to a reachable Redis instance.')
  }
}

export async function attachRedisAdapter(io: SocketIOServer) {
  if (!isRealtimeRedisConfigured()) {
    logger.warn('realtime.redis_adapter_disabled', { reason: 'missing_redis_url' })
    return false
  }

  const pubClient = createRealtimeRedisClient('socket-pub')
  const subClient = pubClient?.duplicate({ connectionName: 'taskit:socket-sub' })
  if (!pubClient || !subClient) return false

  subClient.on('error', (error) => logger.error('realtime.redis_error', error, { name: 'socket-sub' }))
  subClient.on('reconnecting', () => logger.warn('realtime.redis_reconnecting', { name: 'socket-sub' }))

  io.adapter(
    createAdapter(pubClient, subClient, {
      key: process.env.SOCKET_IO_REDIS_KEY || 'taskit:socket.io',
      publishOnSpecificResponseChannel: true,
      requestsTimeout: Math.max(Number(process.env.SOCKET_IO_REQUEST_TIMEOUT_MS ?? 5_000), 1_000),
    })
  )

  logger.info('realtime.redis_adapter_attached')
  return true
}

export function getRealtimeEmitter() {
  if (!isRealtimeRedisConfigured()) return null
  if (realtimeRedisState.__taskitRealtimeEmitter !== undefined) return realtimeRedisState.__taskitRealtimeEmitter

  const redis = createRealtimeRedisClient('socket-emitter')
  if (!redis) {
    realtimeRedisState.__taskitRealtimeEmitterRedis = null
    realtimeRedisState.__taskitRealtimeEmitter = null
    return null
  }

  realtimeRedisState.__taskitRealtimeEmitterRedis = redis
  realtimeRedisState.__taskitRealtimeEmitter = new Emitter(redis, {
    key: process.env.SOCKET_IO_REDIS_KEY || 'taskit:socket.io',
  })
  return realtimeRedisState.__taskitRealtimeEmitter
}
