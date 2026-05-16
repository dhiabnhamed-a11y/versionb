import { Worker, type Job } from 'bullmq'
import { prisma } from '@/lib/db'
import { parseRedisConnection } from '@/modules/realtime/adapters/redis'
import { emitRealtimeEnvelopeDirect, REALTIME_DELIVERY_QUEUE } from '@/modules/realtime/events/delivery'
import { realtimeDeliveryJobSchema } from '@/modules/realtime/events/contracts'
import { recordRealtimeMetric, registerRealtimeQueueMetrics } from '@/modules/realtime/metrics/metrics'
import { logger } from '@/modules/shared/logger'
import { toJsonValue } from '@/modules/shared/json'

function queueRedisUrl() {
  return process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || process.env.REALTIME_REDIS_URL || ''
}

async function markJobRun(jobRunId: string | null | undefined, status: string, data: Record<string, unknown> = {}) {
  if (!jobRunId) return

  await prisma.jobRun.update({
    where: { id: jobRunId },
    data: {
      status,
      attempts: typeof data.attempts === 'number' ? data.attempts : undefined,
      result: data.result === undefined ? undefined : toJsonValue(data.result),
      error: typeof data.error === 'string' ? data.error : undefined,
      startedAt: status === 'ACTIVE' ? new Date() : undefined,
      finishedAt: status === 'COMPLETED' || status === 'FAILED' || status === 'DEAD_LETTER' ? new Date() : undefined,
    },
  })
}

async function processRealtimeDeliveryJob(job: Job) {
  const data = job.data as Record<string, unknown>
  const jobRunId = typeof data.jobRunId === 'string' ? data.jobRunId : null
  await markJobRun(jobRunId, 'ACTIVE', { attempts: job.attemptsMade + 1 })

  const parsed = realtimeDeliveryJobSchema.parse(data)
  const latencyMs = Date.now() - new Date(parsed.queuedAt).getTime()
  recordRealtimeMetric('queue.latency', { queue: REALTIME_DELIVERY_QUEUE, latencyMs, eventType: parsed.envelope.type })

  const delivered = emitRealtimeEnvelopeDirect(parsed)
  if (!delivered) throw new Error('No realtime broadcaster is available.')

  await markJobRun(jobRunId, 'COMPLETED', {
    attempts: job.attemptsMade + 1,
    result: { delivered: true, eventId: parsed.envelope.id, latencyMs },
  })

  return { delivered: true, eventId: parsed.envelope.id, latencyMs }
}

export function startRealtimeDeliveryWorker() {
  const redisUrl = queueRedisUrl()
  if (!redisUrl) {
    logger.warn('realtime.worker_disabled', { reason: 'missing_queue_redis_url' })
    return null
  }

  registerRealtimeQueueMetrics(REALTIME_DELIVERY_QUEUE)

  const worker = new Worker(REALTIME_DELIVERY_QUEUE, processRealtimeDeliveryJob, {
    connection: {
      ...parseRedisConnection(redisUrl),
      maxRetriesPerRequest: null,
    },
    concurrency: Math.max(Number(process.env.REALTIME_WORKER_CONCURRENCY ?? 25), 1),
    limiter: {
      max: Math.max(Number(process.env.REALTIME_WORKER_RATE_LIMIT_MAX ?? 1_000), 1),
      duration: Math.max(Number(process.env.REALTIME_WORKER_RATE_LIMIT_DURATION_MS ?? 1_000), 100),
    },
  })

  worker.on('failed', async (job, error) => {
    const jobRunId = typeof job?.data?.jobRunId === 'string' ? job.data.jobRunId : null
    const finalAttempt = (job?.attemptsMade ?? 0) >= (job?.opts.attempts ?? 1)
    await markJobRun(jobRunId, finalAttempt ? 'DEAD_LETTER' : 'FAILED', {
      attempts: job?.attemptsMade ?? 0,
      error: error.message,
    }).catch((markError) => logger.error('realtime.worker_mark_failed', markError, { jobId: job?.id }))
    logger.error('realtime.worker_job_failed', error, { jobId: job?.id, jobName: job?.name })
  })

  worker.on('error', (error) => logger.error('realtime.worker_error', error))
  logger.info('realtime.worker_started', { queue: REALTIME_DELIVERY_QUEUE })
  return worker
}
