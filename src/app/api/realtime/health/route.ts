import { NextResponse, type NextRequest } from 'next/server'
import { Queue } from 'bullmq'
import { getRealtimeRedis, isRealtimeRedisConfigured, parseRedisConnection } from '@/modules/realtime/adapters/redis'
import { REALTIME_DELIVERY_QUEUE } from '@/modules/realtime/events/delivery'
import { measureRedisLatency } from '@/modules/realtime/metrics/metrics'

export const runtime = 'nodejs'

function authorized(req: NextRequest) {
  const token = process.env.REALTIME_HEALTH_TOKEN
  if (!token) return process.env.NODE_ENV !== 'production'
  return req.headers.get('authorization') === `Bearer ${token}`
}

function queueRedisUrl() {
  return process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || process.env.REALTIME_REDIS_URL || ''
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const redis = getRealtimeRedis()
  const redisLatencyMs = redis ? await measureRedisLatency().catch(() => null) : null
  const queueUrl = queueRedisUrl()
  let queue: Record<string, number> | null = null

  if (queueUrl) {
    const realtimeQueue = new Queue(REALTIME_DELIVERY_QUEUE, {
      connection: { ...parseRedisConnection(queueUrl), maxRetriesPerRequest: null },
    })
    const counts = await realtimeQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused')
    queue = counts
    await realtimeQueue.close()
  }

  return NextResponse.json({
    ok: true,
    redis: {
      configured: isRealtimeRedisConfigured(),
      status: redis?.status ?? 'disabled',
      latencyMs: redisLatencyMs,
    },
    queue,
    socket: {
      adapter: isRealtimeRedisConfigured() ? 'redis' : 'in-memory-local',
      recovery: true,
      path: process.env.SOCKET_IO_PATH || '/api/socketio',
    },
    at: new Date().toISOString(),
  })
}
