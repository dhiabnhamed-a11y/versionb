import type { JobsOptions, Queue } from 'bullmq'
import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { logger } from '@/modules/shared/logger'
import { toJsonValue } from '@/modules/shared/json'

type RedisConnectionOptions = {
  host: string
  port: number
  username?: string
  password?: string
  db?: number
  tls?: Record<string, never>
}

export type OperationalJobInput = {
  queue?: string
  name: string
  companyId?: string | null
  entityType?: string | null
  entityId?: string | null
  payload?: unknown
  runAt?: Date | null
  maxAttempts?: number
}

const queues = new Map<string, Promise<Queue | null>>()

function redisUrl() {
  return process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || ''
}

export function isQueueConfigured() {
  return Boolean(redisUrl())
}

function parseRedisConnection(url: string): RedisConnectionOptions {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port || (parsed.protocol === 'rediss:' ? 6380 : 6379)),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) || undefined : undefined,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  }
}

async function getQueue(queueName: string) {
  if (!isQueueConfigured()) return null

  const existing = queues.get(queueName)
  if (existing) return existing

  const created = import('bullmq')
    .then(({ Queue }) =>
      new Queue(queueName, {
        connection: parseRedisConnection(redisUrl()),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 1_000,
          removeOnFail: false,
        },
      })
    )
    .catch((error) => {
      logger.error('queue.init_failed', error, { queue: queueName })
      return null
    })

  queues.set(queueName, created)
  return created
}

export async function enqueueOperationalJob(input: OperationalJobInput) {
  const queueName = input.queue ?? 'operations'
  const maxAttempts = Math.max(input.maxAttempts ?? 3, 1)
  const configured = isQueueConfigured()

  let runRecord: { id: string } | null = null
  try {
    runRecord = await prisma.jobRun.create({
      data: {
        companyId: input.companyId ?? null,
        queue: queueName,
        name: input.name,
        status: configured ? 'QUEUED' : 'DEFERRED',
        maxAttempts,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        payload: toJsonValue(input.payload),
        runAt: input.runAt ?? null,
      },
      select: { id: true },
    })
  } catch (error) {
    if (!isMissingDatabaseObjectError(error)) throw error
    logger.warn('queue.job_run_skipped_missing_schema', { queue: queueName, jobName: input.name })
  }

  const queue = await getQueue(queueName)
  if (!queue || !runRecord) return runRecord

  const options: JobsOptions = {
    attempts: maxAttempts,
    backoff: { type: 'exponential', delay: 5_000 },
    delay: input.runAt ? Math.max(input.runAt.getTime() - Date.now(), 0) : undefined,
  }

  try {
    const job = await queue.add(input.name, { ...((toJsonValue(input.payload) as object | undefined) ?? {}), jobRunId: runRecord.id }, options)
    await prisma.jobRun.update({
      where: { id: runRecord.id },
      data: { externalId: job.id ? String(job.id) : null },
    })
  } catch (error) {
    logger.error('queue.enqueue_failed', error, { queue: queueName, jobName: input.name, jobRunId: runRecord.id })
    await prisma.jobRun.update({
      where: { id: runRecord.id },
      data: {
        status: 'DEFERRED',
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }

  return runRecord
}
