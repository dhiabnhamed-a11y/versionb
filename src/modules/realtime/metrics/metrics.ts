import { QueueEvents } from 'bullmq'
import { logger } from '@/modules/shared/logger'
import { getRealtimeRedis, isRealtimeRedisConfigured, parseRedisConnection } from '@/modules/realtime/adapters/redis'

export type RealtimeMetricName =
  | 'socket.connected'
  | 'socket.disconnected'
  | 'socket.auth_failed'
  | 'socket.rate_limited'
  | 'socket.recovered'
  | 'presence.online'
  | 'presence.offline'
  | 'event.queued'
  | 'event.delivered'
  | 'event.failed'
  | 'event.replayed'
  | 'redis.latency'
  | 'queue.latency'

const METRIC_TTL_SECONDS = Math.max(Number(process.env.REALTIME_METRIC_TTL_SECONDS ?? 60 * 60 * 24), 60)
const queueEventState = globalThis as typeof globalThis & {
  __taskitRealtimeQueueEvents?: QueueEvents
}

export function recordRealtimeMetric(name: RealtimeMetricName, fields: Record<string, unknown> = {}) {
  const at = new Date().toISOString()
  logger.info(`realtime.metric.${name}`, { at, ...fields })

  const redis = getRealtimeRedis()
  if (!redis) return

  const dateKey = at.slice(0, 13).replace(/[-:T]/g, '')
  const metricKey = `taskit:realtime:metrics:${dateKey}`
  void redis
    .multi()
    .hincrby(metricKey, name, 1)
    .expire(metricKey, METRIC_TTL_SECONDS)
    .exec()
    .catch((error) => logger.warn('realtime.metric_redis_failed', { metric: name, error: error instanceof Error ? error.message : String(error) }))
}

export async function measureRedisLatency() {
  const redis = getRealtimeRedis()
  if (!redis) return null

  const startedAt = Date.now()
  await redis.ping()
  const latencyMs = Date.now() - startedAt
  recordRealtimeMetric('redis.latency', { latencyMs })
  return latencyMs
}

export function registerRealtimeQueueMetrics(queueName = 'realtime-delivery') {
  if (!isRealtimeRedisConfigured() || queueEventState.__taskitRealtimeQueueEvents) return null

  const events = new QueueEvents(queueName, {
    connection: {
      ...parseRedisConnection(process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || process.env.REALTIME_REDIS_URL || ''),
      maxRetriesPerRequest: null,
    },
  })

  events.on('completed', ({ jobId }) => recordRealtimeMetric('event.delivered', { queue: queueName, jobId }))
  events.on('failed', ({ jobId, failedReason }) => recordRealtimeMetric('event.failed', { queue: queueName, jobId, failedReason }))
  events.on('error', (error) => logger.error('realtime.queue_events_error', error, { queue: queueName }))

  queueEventState.__taskitRealtimeQueueEvents = events
  return events
}
