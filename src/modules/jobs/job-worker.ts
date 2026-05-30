import { prisma } from '@/lib/db'
import { logger } from '@/modules/shared/logger'
import { toJsonValue } from '@/modules/shared/json'
import { isQueueConfigured } from '@/modules/jobs/job-queue'
import { SOCIAL_INTEGRATIONS_QUEUE } from '@/modules/integrations/jobs/social-job-queue'
import { processSocialIntegrationJob } from '@/modules/integrations/jobs/social-job-handlers'
import { checkActiveSlaCompliance } from '@/modules/enterprise/enterprise-sla-monitor'
import { autoAssignUnassignedIncidents, autoAssignIncident } from '@/modules/enterprise/enterprise-auto-assigner'
import { checkApprovalEscalations } from '@/modules/enterprise/enterprise-escalation'
import { runDepreciationEngine } from '@/modules/enterprise/enterprise-depreciation'
import { autoCloseResolvedIncidents } from '@/modules/enterprise/enterprise-auto-close'
import { generateRecurringTickets } from '@/modules/enterprise/enterprise-recurring'
import { registerEnterpriseCronJobs } from '@/modules/enterprise/enterprise-cron'

type RedisConnectionOptions = {
  host: string
  port: number
  username?: string
  password?: string
  db?: number
  tls?: Record<string, never>
}

const workerState = globalThis as typeof globalThis & {
  __taskitWorkersStarted?: boolean
}

function redisUrl() {
  return process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || ''
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

async function markJobRun(jobRunId: string | undefined, status: string, data: Record<string, unknown> = {}) {
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

async function ingestAnalyticsEvent(data: Record<string, unknown>) {
  const companyId = typeof data.companyId === 'string' ? data.companyId : null
  const eventType = typeof data.eventType === 'string' ? data.eventType : null
  if (!companyId || !eventType) return { skipped: true }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const key = `events.${eventType}`

  const existing = await prisma.analyticsMetric.findFirst({
    where: { companyId, key, scope: 'daily', periodStart: today, periodEnd: tomorrow },
    select: { id: true, value: true },
  })
  const currentValue = existing?.value && typeof existing.value === 'object' && 'count' in existing.value ? Number(existing.value.count) : 0

  if (existing) {
    await prisma.analyticsMetric.update({
      where: { id: existing.id },
      data: { value: { count: currentValue + 1, eventType }, computedAt: new Date(), expiresAt: tomorrow },
    })
  } else {
    await prisma.analyticsMetric.create({
      data: {
        companyId,
        key,
        scope: 'daily',
        periodStart: today,
        periodEnd: tomorrow,
        value: { count: 1, eventType },
        expiresAt: tomorrow,
      },
    })
  }

  return { counted: true, key }
}

async function processOperationsJob(name: string, data: Record<string, unknown>) {
  if (name === 'analytics.ingest-event') {
    return ingestAnalyticsEvent(data)
  }

  if (name === 'enterprise.sla-monitor') {
    return checkActiveSlaCompliance()
  }

  if (name === 'enterprise.auto-assign') {
    const companyId = typeof data.companyId === 'string' ? data.companyId : undefined
    return autoAssignUnassignedIncidents(companyId)
  }

  if (name === 'enterprise.auto-assign-single') {
    const incidentId = typeof data.incidentId === 'string' ? data.incidentId : ''
    const companyId = typeof data.companyId === 'string' ? data.companyId : ''
    if (!incidentId || !companyId) return { error: 'missing incidentId or companyId' }
    return autoAssignIncident(incidentId, companyId)
  }

  if (name === 'enterprise.approval-escalation') {
    return checkApprovalEscalations()
  }

  if (name === 'enterprise.depreciation') {
    return runDepreciationEngine()
  }

  if (name === 'enterprise.auto-close') {
    return autoCloseResolvedIncidents()
  }

  if (name === 'enterprise.recurring-tickets') {
    return generateRecurringTickets()
  }

  return { ignored: true, name }
}

export async function startBackgroundJobWorkers() {
  if (workerState.__taskitWorkersStarted || !isQueueConfigured()) return false
  workerState.__taskitWorkersStarted = true

  const { Worker } = await import('bullmq')
  const startWorker = (queueName: string, processor: (name: string, data: Record<string, unknown>, attempts: number) => Promise<unknown>) => {
    const worker = new Worker(
      queueName,
      async (job) => {
      const data = job.data as Record<string, unknown>
      const jobRunId = typeof data.jobRunId === 'string' ? data.jobRunId : undefined
      await markJobRun(jobRunId, 'ACTIVE', { attempts: job.attemptsMade + 1 })

      try {
        const result = await processor(job.name, data, job.attemptsMade + 1)
        await markJobRun(jobRunId, 'COMPLETED', { result, attempts: job.attemptsMade + 1 })
        return result
      } catch (error) {
        const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
        await markJobRun(jobRunId, finalAttempt ? 'DEAD_LETTER' : 'FAILED', {
          error: error instanceof Error ? error.message : String(error),
          attempts: job.attemptsMade + 1,
        })
        throw error
      }
    },
      { connection: parseRedisConnection(redisUrl()), concurrency: Number(process.env.QUEUE_CONCURRENCY ?? 5) || 5 }
    )

    worker.on('failed', (job, error) => {
      logger.error('queue.worker_job_failed', error, { queue: queueName, jobId: job?.id, jobName: job?.name })
    })

    worker.on('error', (error) => {
      logger.error('queue.worker_error', error, { queue: queueName })
    })

    logger.info('queue.worker_started', { queue: queueName })
    return worker
  }

  startWorker('operations', processOperationsJob)
  startWorker(SOCIAL_INTEGRATIONS_QUEUE, processSocialIntegrationJob)

  registerEnterpriseCronJobs().catch((error) => logger.error('enterprise.cron_registration_failed', error))

  return true
}
