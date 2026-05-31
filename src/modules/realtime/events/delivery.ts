import type { Queue } from 'bullmq'
import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { getRealtimeEmitter } from '@/modules/realtime/adapters/redis'
import {
  buildRealtimeEnvelope,
  realtimeDeliveryJobSchema,
  type RealtimeDeliveryJob,
  type RealtimeDeliveryTarget,
  type RealtimeEnvelope,
  workspaceRoom,
  userRoom,
} from '@/modules/realtime/events/contracts'
import { appendRealtimeEventLog } from '@/modules/realtime/events/event-log'
import { recordRealtimeMetric } from '@/modules/realtime/metrics/metrics'
import { logger } from '@/modules/shared/logger'
import { toJsonValue } from '@/modules/shared/json'
import { legacyRealtimeEventName, type RealtimeEventName, type RealtimeWorkspaceEvent } from '@/lib/realtime-events'

export const REALTIME_DELIVERY_QUEUE = 'realtime-delivery'

const queueState = globalThis as typeof globalThis & {
  __taskitRealtimeDeliveryQueue?: Promise<Queue | null>
  __taskitRealtimeDeliveryBatch?: Map<string, PendingRealtimeDelivery>
  __taskitRealtimeDeliveryBatchTimer?: ReturnType<typeof setTimeout> | null
  __taskitRealtimeRecentEmits?: Map<string, number>
}

type PendingRealtimeDelivery = {
  parsed: RealtimeDeliveryJob
  room: string
  legacyEvent: RealtimeEventName | null
  patch: unknown
  workspaceEvent: RealtimeWorkspaceEvent
}

const DELIVERY_DEDUP_WINDOW_MS = Math.max(Number(process.env.REALTIME_DELIVERY_DEDUP_WINDOW_MS ?? 100), 25)
const DELIVERY_BATCH_DEBOUNCE_MS = Math.max(Number(process.env.REALTIME_DELIVERY_BATCH_DEBOUNCE_MS ?? 50), 10)

function realtimeWorkspaceEvent(envelope: RealtimeEnvelope): RealtimeWorkspaceEvent {
  return {
    type: envelope.type,
    payload: envelope.payload,
    at: envelope.timestamp,
  }
}

function extractRealtimePatch(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  if (!('realtimePatch' in payload)) return null
  return (payload as { realtimePatch?: unknown }).realtimePatch ?? null
}

function deliveryBatch() {
  if (!queueState.__taskitRealtimeDeliveryBatch) queueState.__taskitRealtimeDeliveryBatch = new Map()
  return queueState.__taskitRealtimeDeliveryBatch
}

function recentEmits() {
  if (!queueState.__taskitRealtimeRecentEmits) queueState.__taskitRealtimeRecentEmits = new Map()
  return queueState.__taskitRealtimeRecentEmits
}

function targetId(target: RealtimeDeliveryTarget) {
  return target.scope === 'workspace' ? target.workspaceId : target.userId
}

function deliveryDedupKey(parsed: RealtimeDeliveryJob) {
  return [parsed.target.scope, targetId(parsed.target), parsed.envelope.type, parsed.envelope.entityId ?? parsed.envelope.id].join(':')
}

function cleanupRecentEmitKeys(now: number) {
  for (const [key, at] of recentEmits()) {
    if (now - at > DELIVERY_DEDUP_WINDOW_MS) recentEmits().delete(key)
  }
}

function flushRealtimeDeliveryBatch() {
  queueState.__taskitRealtimeDeliveryBatchTimer = null
  const pending = Array.from(deliveryBatch().entries())
  deliveryBatch().clear()
  const now = Date.now()
  cleanupRecentEmitKeys(now)

  for (const [dedupKey, item] of pending) {
    const broadcaster = global.io ?? getRealtimeEmitter()
    if (!broadcaster) {
      logger.warn('realtime.no_broadcaster_available', { eventId: item.parsed.envelope.id, eventType: item.parsed.envelope.type })
      continue
    }

    const channel = broadcaster.to(item.room)

    void appendRealtimeEventLog(item.parsed.envelope, item.parsed.target).catch((error) =>
      logger.warn('realtime.event_log_append_failed', { eventId: item.parsed.envelope.id, error: error instanceof Error ? error.message : String(error) })
    )

    if (item.parsed.emitLegacyEvent && item.legacyEvent) {
      channel.emit(item.legacyEvent, item.parsed.envelope.payload)
    }
    if (item.patch) channel.emit('realtime:patch', item.patch)
    channel.emit('workspace_event', item.workspaceEvent)
    channel.emit('realtime:event', item.parsed.envelope)

    recentEmits().set(dedupKey, now)
    recordRealtimeMetric('event.delivered', {
      eventId: item.parsed.envelope.id,
      eventType: item.parsed.envelope.type,
      targetScope: item.parsed.target.scope,
      workspaceId: item.parsed.envelope.workspaceId,
    })
  }
}

function queueRedisUrl() {
  return process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || process.env.REALTIME_REDIS_URL || ''
}

function isQueueConfigured() {
  return Boolean(queueRedisUrl())
}

function parseQueueRedisConnection(url: string) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port || (parsed.protocol === 'rediss:' ? 6380 : 6379)),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) || undefined : undefined,
    maxRetriesPerRequest: null,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  }
}

async function getRealtimeQueue() {
  if (!isQueueConfigured()) return null
  if (queueState.__taskitRealtimeDeliveryQueue) return queueState.__taskitRealtimeDeliveryQueue

  queueState.__taskitRealtimeDeliveryQueue = import('bullmq')
    .then(({ Queue }) =>
      new Queue(REALTIME_DELIVERY_QUEUE, {
        connection: parseQueueRedisConnection(queueRedisUrl()),
        defaultJobOptions: {
          attempts: Math.max(Number(process.env.REALTIME_DELIVERY_ATTEMPTS ?? 5), 1),
          backoff: { type: 'exponential', delay: Math.max(Number(process.env.REALTIME_DELIVERY_BACKOFF_MS ?? 1_000), 250) },
          removeOnComplete: Math.max(Number(process.env.REALTIME_DELIVERY_REMOVE_COMPLETE ?? 5_000), 100),
          removeOnFail: false,
        },
      })
    )
    .catch((error) => {
      logger.error('realtime.queue_init_failed', error)
      return null
    })

  return queueState.__taskitRealtimeDeliveryQueue
}

async function recordDeliveryJob(input: RealtimeDeliveryJob, status: 'QUEUED' | 'DEFERRED') {
  try {
    return await prisma.jobRun.create({
      data: {
        companyId: input.envelope.workspaceId ?? null,
        queue: REALTIME_DELIVERY_QUEUE,
        name: input.envelope.type,
        status,
        maxAttempts: Math.max(Number(process.env.REALTIME_DELIVERY_ATTEMPTS ?? 5), 1),
        entityType: 'realtime_event',
        entityId: input.envelope.entityId ?? input.envelope.id,
        payload: toJsonValue(input),
      },
      select: { id: true },
    })
  } catch (error) {
    if (!isMissingDatabaseObjectError(error)) throw error
    logger.warn('realtime.job_run_skipped_missing_schema', { eventId: input.envelope.id, eventType: input.envelope.type })
    return null
  }
}

export function emitRealtimeEnvelopeDirect(input: RealtimeDeliveryJob) {
  const parsed = realtimeDeliveryJobSchema.parse(input)
  const io = global.io
  const emitter = getRealtimeEmitter()
  const broadcaster = io ?? emitter

  if (!broadcaster) {
    logger.warn('realtime.no_broadcaster_available', { eventId: parsed.envelope.id, eventType: parsed.envelope.type })
    return false
  }

  const room = parsed.target.scope === 'workspace' ? workspaceRoom(parsed.target.workspaceId) : userRoom(parsed.target.userId)
  const legacyEvent = legacyRealtimeEventName(parsed.envelope.type)
  const patch = extractRealtimePatch(parsed.envelope.payload)
  const dedupKey = deliveryDedupKey(parsed)
  const now = Date.now()
  const recent = recentEmits().get(dedupKey)

  cleanupRecentEmitKeys(now)

  if (recent && now - recent < DELIVERY_DEDUP_WINDOW_MS) {
    recordRealtimeMetric('event.delivered', {
      eventId: parsed.envelope.id,
      eventType: parsed.envelope.type,
      targetScope: parsed.target.scope,
      workspaceId: parsed.envelope.workspaceId,
      deduped: true,
    })
    return true
  }

  deliveryBatch().set(dedupKey, {
    parsed,
    room,
    legacyEvent,
    patch,
    workspaceEvent: realtimeWorkspaceEvent(parsed.envelope),
  })

  if (!queueState.__taskitRealtimeDeliveryBatchTimer) {
    queueState.__taskitRealtimeDeliveryBatchTimer = setTimeout(flushRealtimeDeliveryBatch, DELIVERY_BATCH_DEBOUNCE_MS)
  }

  return true
}

export async function enqueueRealtimeDelivery(input: {
  type: RealtimeEventName
  target: RealtimeDeliveryTarget
  payload: unknown
  workspaceId?: string | null
  entityId?: string | null
  actorId?: string | null
  correlationId?: string | null
  emitLegacyEvent?: boolean
}) {
  const envelope = buildRealtimeEnvelope({
    type: input.type,
    workspaceId: input.workspaceId ?? (input.target.scope === 'workspace' ? input.target.workspaceId : null),
    entityId: input.entityId ?? null,
    actorId: input.actorId ?? null,
    payload: input.payload,
    correlationId: input.correlationId ?? null,
  })
  const job = realtimeDeliveryJobSchema.parse({
    envelope,
    target: input.target,
    emitLegacyEvent: input.emitLegacyEvent ?? true,
    queuedAt: new Date().toISOString(),
  })

  const queue = await getRealtimeQueue()
  const runRecord = await recordDeliveryJob(job, queue ? 'QUEUED' : 'DEFERRED')

  if (!queue) {
    emitRealtimeEnvelopeDirect(job)
    return envelope
  }

  const resourceId = envelope.entityId ?? envelope.id
  const deduplicationKey = `${job.target.scope}:${job.target.scope === 'workspace' ? job.target.workspaceId : job.target.userId}:${envelope.type}:${resourceId}`
  const queued = await queue.add(envelope.type, { ...job, jobRunId: runRecord?.id ?? null }, {
    jobId: envelope.id,
    deduplication: { id: deduplicationKey, ttl: DELIVERY_DEDUP_WINDOW_MS },
  })
  if (runRecord) {
    await prisma.jobRun.update({
      where: { id: runRecord.id },
      data: {
        externalId: queued.id ? String(queued.id) : null,
        status: queued.id && String(queued.id) !== envelope.id ? 'COMPLETED' : undefined,
        finishedAt: queued.id && String(queued.id) !== envelope.id ? new Date() : undefined,
        result: queued.id && String(queued.id) !== envelope.id ? toJsonValue({ deduped: true, dedupedByJobId: queued.id }) : undefined,
      },
    })
  }

  recordRealtimeMetric('event.queued', {
    eventId: envelope.id,
    eventType: envelope.type,
    targetScope: job.target.scope,
    workspaceId: envelope.workspaceId,
  })
  return envelope
}
