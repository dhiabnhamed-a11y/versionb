import Redis from 'ioredis'

type SharedRedis = Redis

const globalRedis = globalThis as typeof globalThis & {
  __taskitSharedRedis?: SharedRedis | null
}

export function getSharedRedis() {
  if (globalRedis.__taskitSharedRedis !== undefined) return globalRedis.__taskitSharedRedis
  const url = process.env.REDIS_URL || process.env.QUEUE_REDIS_URL || process.env.REALTIME_REDIS_URL
  if (!url) {
    globalRedis.__taskitSharedRedis = null
    return null
  }

  globalRedis.__taskitSharedRedis = new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
    connectTimeout: 5_000,
    commandTimeout: 4_000,
    lazyConnect: true,
  })
  return globalRedis.__taskitSharedRedis
}

export async function pingSharedRedis() {
  const client = getSharedRedis()
  if (!client) return null
  const started = Date.now()
  await client.ping()
  return Date.now() - started
}
