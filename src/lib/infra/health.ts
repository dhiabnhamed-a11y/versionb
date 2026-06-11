import { PrismaClient } from '@prisma/client'
import { Queue } from 'bullmq'
import { prisma } from '@/lib/db'
import { isQueueConfigured, parseRedisConnection } from '@/modules/jobs/job-queue'
import { isRealtimeRedisConfigured, getRealtimeRedis } from '@/modules/realtime/adapters/redis'
import { REALTIME_DELIVERY_QUEUE } from '@/modules/realtime/events/delivery'
import { pingSharedRedis } from '@/lib/infra/redis-shared'
import { measureRedisLatency } from '@/modules/realtime/metrics/metrics'

export type InfraHealthSnapshot = {
  ok: boolean
  db: 'up' | 'down'
  redis: { configured: boolean; status: string; latencyMs: number | null }
  queues: Record<string, number> | null
  at: string
}

export type PublicHealthSnapshot = {
  ok: boolean
  at: string
}

function queueUrl() {
  return process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || ''
}

export async function collectInfraHealth(): Promise<InfraHealthSnapshot> {
  let db: 'up' | 'down' = 'down'
  try {
    // eslint-disable-next-line no-restricted-syntax
    await (prisma as unknown as PrismaClient).$queryRaw`SELECT 1`
    db = 'up'
  } catch {
    db = 'down'
  }

  const redisClient = getRealtimeRedis()
  const redisLatencyMs =
    (await pingSharedRedis().catch(() => null)) ??
    (redisClient ? await measureRedisLatency().catch(() => null) : null)

  let queues: Record<string, number> | null = null
  const url = queueUrl()
  if (url && isQueueConfigured()) {
    const queue = new Queue(REALTIME_DELIVERY_QUEUE, {
      connection: { ...parseRedisConnection(url), maxRetriesPerRequest: null },
    })
    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed')
      queues = counts
    } finally {
      await queue.close()
    }
  }

  const ok = db === 'up'
  return {
    ok,
    db,
    redis: {
      configured: isRealtimeRedisConfigured(),
      status: redisClient?.status ?? 'disabled',
      latencyMs: redisLatencyMs,
    },
    queues,
    at: new Date().toISOString(),
  }
}

export function toPublicHealth(snapshot: InfraHealthSnapshot): PublicHealthSnapshot {
  return { ok: snapshot.ok, at: snapshot.at }
}

export async function collectPublicHealth(): Promise<PublicHealthSnapshot> {
  return toPublicHealth(await collectInfraHealth())
}
