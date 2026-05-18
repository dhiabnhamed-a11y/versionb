import { Queue } from 'bullmq'
import { parseRedisConnection } from '@/modules/jobs/job-queue'
import { logger } from '@/modules/shared/logger'

export const DEAD_LETTER_QUEUE = 'operations-dead-letter'

let deadLetterQueue: Queue | null = null

function redisUrl() {
  return process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || ''
}

export async function getDeadLetterQueue() {
  const url = redisUrl()
  if (!url) return null
  if (deadLetterQueue) return deadLetterQueue

  deadLetterQueue = new Queue(DEAD_LETTER_QUEUE, {
    connection: { ...parseRedisConnection(url), maxRetriesPerRequest: null },
    defaultJobOptions: { removeOnComplete: 5_000, removeOnFail: false },
  })
  return deadLetterQueue
}

export async function moveToDeadLetter(input: {
  sourceQueue: string
  jobId: string | undefined
  name: string
  payload: unknown
  error: string
}) {
  const queue = await getDeadLetterQueue()
  if (!queue) return
  await queue.add('failed-job', {
    ...input,
    at: new Date().toISOString(),
  })
  logger.error('queue.dead_letter', { sourceQueue: input.sourceQueue, jobId: input.jobId, error: input.error })
}
