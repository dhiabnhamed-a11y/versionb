import { isQueueConfigured } from '@/modules/jobs/job-queue'
import { logger } from '@/modules/shared/logger'

export async function registerEnterpriseCronJobs() {
  if (!isQueueConfigured()) {
    logger.info('enterprise.cron_skipped_no_queue')
    return
  }

  const { Queue } = await import('bullmq')
  const { parseRedisConnection } = await import('@/modules/jobs/job-queue')

  const CORE_QUEUE = 'operations'

  const queue = new Queue(CORE_QUEUE, {
    connection: parseRedisConnection(process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || ''),
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: 100,
      removeOnFail: false,
    },
  })

  await queue.upsertJobScheduler('enterprise-sla-monitor', {
    every: 60_000,
  }, {
    name: 'enterprise.sla-monitor',
    data: {},
    opts: { attempts: 2, removeOnComplete: 10, removeOnFail: false },
  })

  await queue.upsertJobScheduler('enterprise-auto-assign', {
    every: 120_000,
  }, {
    name: 'enterprise.auto-assign',
    data: {},
    opts: { attempts: 2, removeOnComplete: 10, removeOnFail: false },
  })

  await queue.upsertJobScheduler('enterprise-approval-escalation', {
    every: 120_000,
  }, {
    name: 'enterprise.approval-escalation',
    data: {},
    opts: { attempts: 2, removeOnComplete: 10, removeOnFail: false },
  })

  await queue.upsertJobScheduler('enterprise-depreciation', {
    every: 86_400_000,
  }, {
    name: 'enterprise.depreciation',
    data: {},
    opts: { attempts: 2, removeOnComplete: 10, removeOnFail: false },
  })

  await queue.upsertJobScheduler('enterprise-auto-close', {
    every: 300_000,
  }, {
    name: 'enterprise.auto-close',
    data: {},
    opts: { attempts: 2, removeOnComplete: 10, removeOnFail: false },
  })

  await queue.upsertJobScheduler('enterprise-recurring-tickets', {
    every: 600_000,
  }, {
    name: 'enterprise.recurring-tickets',
    data: {},
    opts: { attempts: 2, removeOnComplete: 10, removeOnFail: false },
  })

  logger.info('enterprise.cron_registered', { queue: CORE_QUEUE, jobs: ['enterprise-sla-monitor (every 60s)', 'enterprise-auto-assign (every 120s)', 'enterprise-approval-escalation (every 120s)', 'enterprise-depreciation (every 24h)', 'enterprise-auto-close (every 5m)', 'enterprise-recurring-tickets (every 10m)'] })

  await queue.close()
}
