import 'dotenv/config'
import { Worker } from 'bullmq'
import { parseRedisConnection } from '@/modules/realtime/adapters/redis'
import { logger } from '@/modules/shared/logger'
import { keepWorkerAlive, installWorkerShutdown } from '@/workers/runtime'

const AI_QUEUES = ['ai-planning', 'ai-execution', 'ai-embeddings', 'ai-reports'] as const

function queueRedisUrl() {
  return process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || ''
}

const redisUrl = queueRedisUrl()
const workers = redisUrl
  ? AI_QUEUES.map(
      (queueName) =>
        new Worker(
          queueName,
          async (job) => {
            logger.info('ai.worker_job_received', { queue: queueName, jobId: job.id, jobName: job.name })
            return { delegated: false, reason: 'No dedicated AI processor registered for this job name yet.' }
          },
          {
            connection: { ...parseRedisConnection(redisUrl), maxRetriesPerRequest: null },
            concurrency: Math.max(Number(process.env.AI_WORKER_CONCURRENCY ?? 2), 1),
          }
        )
    )
  : []

for (const worker of workers) {
  worker.on('failed', (job, error) => logger.error('ai.worker_job_failed', error, { queue: worker.name, jobId: job?.id, jobName: job?.name }))
  worker.on('error', (error) => logger.error('ai.worker_error', error, { queue: worker.name }))
}

if (!workers.length) logger.warn('ai.worker_disabled', { reason: 'missing_queue_redis_url' })
installWorkerShutdown('ai', workers)
keepWorkerAlive(workers.length ? 'ai' : 'ai-disabled')
