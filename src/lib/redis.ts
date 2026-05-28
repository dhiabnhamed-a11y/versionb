import Redis from 'ioredis'
import { getRealtimeRedisUrl, parseRedisConnection, isRealtimeRedisConfigured } from '@/modules/realtime/adapters/redis'

let connection: Redis | null = null

export function getRedisConnection(): Redis {
  if (connection?.status === 'ready') return connection

  const url = getRealtimeRedisUrl()
  if (!url) {
    // Create a minimal local connection for development
    connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    })
  } else {
    const opts = parseRedisConnection(url)
    connection = new Redis({ ...opts, maxRetriesPerRequest: null, enableOfflineQueue: false })
  }

  return connection
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit()
    connection = null
  }
}

export { isRealtimeRedisConfigured }
