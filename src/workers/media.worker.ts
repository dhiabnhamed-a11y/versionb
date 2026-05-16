import 'dotenv/config'
import { Worker } from 'bullmq'
import { parseRedisConnection } from '@/modules/realtime/adapters/redis'
import { logger } from '@/modules/shared/logger'
import { keepWorkerAlive, installWorkerShutdown } from '@/workers/runtime'

function queueRedisUrl() {
  return process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || ''
}

const redisUrl = queueRedisUrl()
const worker = redisUrl
  ? new Worker(
      'media',
      async (job) => {
        logger.info('media.worker_job_received', { jobId: job.id, jobName: job.name })
        return { delegated: false, reason: 'No dedicated media processor registered for this job name yet.' }
      },
      {
        connection: { ...parseRedisConnection(redisUrl), maxRetriesPerRequest: null },
        concurrency: Math.max(Number(process.env.MEDIA_WORKER_CONCURRENCY ?? 2), 1),
      }
    )
  : null

worker?.on('failed', (job, error) => logger.error('media.worker_job_failed', error, { jobId: job?.id, jobName: job?.name }))
worker?.on('error', (error) => logger.error('media.worker_error', error))

if (!worker) logger.warn('media.worker_disabled', { reason: 'missing_queue_redis_url' })
installWorkerShutdown('media', [worker])
keepWorkerAlive(worker ? 'media' : 'media-disabled')
