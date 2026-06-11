import { tenantQueryRaw, tenantExecuteRaw } from '@/lib/tenant/tenant-raw-query';
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { getRealtimeRedis } from '@/modules/realtime/adapters/redis'
import { realtimeEnvelopeSchema, type RealtimeDeliveryTarget, type RealtimeEnvelope } from '@/modules/realtime/events/contracts'
import { recordRealtimeMetric } from '@/modules/realtime/metrics/metrics'
import { logger } from '@/modules/shared/logger'

const STREAM_MAXLEN = Math.max(Number(process.env.REALTIME_STREAM_MAXLEN ?? 10_000), 1_000)
const DB_REPLAY_LIMIT = Math.max(Number(process.env.REALTIME_DB_REPLAY_LIMIT ?? 500), 50)

function workspaceEventStreamKey(workspaceId: string) {
  return `taskit:realtime:events:${workspaceId}`
}

function userOffsetKey(userId: string) {
  return `taskit:realtime:consumer:${userId}:offsets`
}

function targetRoomKey(target: RealtimeDeliveryTarget) {
  return target.scope === 'workspace' ? `workspace:${target.workspaceId}` : `user:${target.userId}`
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? null)
}

async function appendDatabaseEvent(envelope: RealtimeEnvelope, target: RealtimeDeliveryTarget, streamId: string | null) {
  try {
    await tenantExecuteRaw`
      INSERT INTO "RealtimeEventLog" (
        "id",
        "workspaceId",
        "targetScope",
        "targetId",
        "type",
        "entityId",
        "actorId",
        "correlationId",
        "payload",
        "envelope",
        "streamId",
        "createdAt"
      )
      VALUES (
        ${envelope.id},
        ${envelope.workspaceId},
        ${target.scope},
        ${target.scope === 'workspace' ? target.workspaceId : target.userId},
        ${envelope.type},
        ${envelope.entityId ?? null},
        ${envelope.actorId ?? null},
        ${envelope.correlationId ?? null},
        CAST(${stringifyJson(envelope.payload)} AS JSONB),
        CAST(${stringifyJson(envelope)} AS JSONB),
        ${streamId},
        ${new Date(envelope.timestamp)}
      )
      ON CONFLICT ("id") DO NOTHING
    `
  } catch (error) {
    if (!isMissingDatabaseObjectError(error)) {
      logger.warn('realtime.event_log_insert_failed', { eventId: envelope.id, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

export async function appendRealtimeEventLog(envelope: RealtimeEnvelope, target: RealtimeDeliveryTarget) {
  let streamId: string | null = null
  const redis = getRealtimeRedis()

  if (redis && envelope.workspaceId) {
    try {
      streamId = await redis.xadd(
        workspaceEventStreamKey(envelope.workspaceId),
        'MAXLEN',
        '~',
        STREAM_MAXLEN,
        '*',
        'eventId',
        envelope.id,
        'type',
        envelope.type,
        'target',
        targetRoomKey(target),
        'entityId',
        envelope.entityId ?? '',
        'timestamp',
        envelope.timestamp,
        'envelope',
        stringifyJson(envelope)
      )
    } catch (error) {
      logger.warn('realtime.stream_append_failed', { eventId: envelope.id, error: error instanceof Error ? error.message : String(error) })
    }
  }

  await appendDatabaseEvent(envelope, target, streamId)
  return streamId
}

function parseStreamEnvelope(fields: string[]) {
  try {
    const envelopeIndex = fields.indexOf('envelope')
    if (envelopeIndex < 0) return null

    const parsed = realtimeEnvelopeSchema.safeParse(JSON.parse(fields[envelopeIndex + 1] ?? 'null'))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

async function loadStreamReplay(workspaceId: string, afterEventId: string | null, limit: number) {
  const redis = getRealtimeRedis()
  if (!redis) return null

  const rows = await redis.xrange(workspaceEventStreamKey(workspaceId), '-', '+', 'COUNT', Math.max(limit * 2, limit))
  const events = rows.map(([, fields]) => parseStreamEnvelope(fields)).filter((event): event is RealtimeEnvelope => Boolean(event))
  const afterIndex = afterEventId ? events.findIndex((event) => event.id === afterEventId) : -1
  return (afterIndex >= 0 ? events.slice(afterIndex + 1) : events).slice(-limit)
}

async function loadDatabaseReplay(workspaceId: string, afterEventId: string | null, limit: number) {
  try {
    const rows = await tenantQueryRaw<Array<{ envelope: Prisma.JsonValue }>>`
      SELECT "envelope"
      FROM "RealtimeEventLog"
      WHERE "workspaceId" = ${workspaceId}
      ORDER BY "createdAt" DESC, "sequence" DESC
      LIMIT ${Math.min(Math.max(limit * 2, limit), DB_REPLAY_LIMIT)}
    `

    const events = rows
      .map((row) => {
        const parsed = realtimeEnvelopeSchema.safeParse(row.envelope)
        return parsed.success ? parsed.data : null
      })
      .filter((event): event is RealtimeEnvelope => Boolean(event))
      .reverse()

    const afterIndex = afterEventId ? events.findIndex((event) => event.id === afterEventId) : -1
    return (afterIndex >= 0 ? events.slice(afterIndex + 1) : events).slice(-limit)
  } catch (error) {
    if (!isMissingDatabaseObjectError(error)) {
      logger.error('realtime.event_log_replay_failed', error, { workspaceId })
    }
    return null
  }
}

export async function recordRealtimeConsumerOffset(input: { userId: string; workspaceId?: string | null; eventId: string }) {
  const redis = getRealtimeRedis()
  if (redis && input.workspaceId) {
    await redis.hset(userOffsetKey(input.userId), input.workspaceId, input.eventId)
    await redis.expire(userOffsetKey(input.userId), Math.max(Number(process.env.REALTIME_CONSUMER_OFFSET_TTL_SECONDS ?? 60 * 60 * 24 * 30), 3_600))
  }

  try {
    await tenantExecuteRaw`
      INSERT INTO "RealtimeConsumerOffset" ("consumerId", "workspaceId", "lastEventId", "updatedAt")
      VALUES (${input.userId}, ${input.workspaceId ?? ''}, ${input.eventId}, CURRENT_TIMESTAMP)
      ON CONFLICT ("consumerId", "workspaceId")
      DO UPDATE SET "lastEventId" = EXCLUDED."lastEventId", "updatedAt" = CURRENT_TIMESTAMP
    `
  } catch (error) {
    if (!isMissingDatabaseObjectError(error)) {
      logger.warn('realtime.consumer_offset_failed', { userId: input.userId, eventId: input.eventId, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

export async function getRealtimeConsumerOffset(input: { userId: string; workspaceId: string }) {
  const redis = getRealtimeRedis()
  if (redis) {
    const eventId = await redis.hget(userOffsetKey(input.userId), input.workspaceId)
    if (eventId) return eventId
  }

  try {
    const rows = await tenantQueryRaw<Array<{ lastEventId: string }>>`
      SELECT "lastEventId"
      FROM "RealtimeConsumerOffset"
      WHERE "consumerId" = ${input.userId} AND "workspaceId" = ${input.workspaceId}
      LIMIT 1
    `
    return rows[0]?.lastEventId ?? null
  } catch (error) {
    if (!isMissingDatabaseObjectError(error)) logger.warn('realtime.consumer_offset_load_failed', { userId: input.userId, workspaceId: input.workspaceId })
    return null
  }
}

export async function loadRealtimeEventLogReplay(input: { workspaceId: string; afterEventId?: string | null; limit: number }) {
  const streamEvents = await loadStreamReplay(input.workspaceId, input.afterEventId ?? null, input.limit).catch((error) => {
    logger.warn('realtime.stream_replay_failed', { workspaceId: input.workspaceId, error: error instanceof Error ? error.message : String(error) })
    return null
  })

  const replay = streamEvents ?? (await loadDatabaseReplay(input.workspaceId, input.afterEventId ?? null, input.limit))
  if (replay?.length) recordRealtimeMetric('event.replayed', { workspaceId: input.workspaceId, count: replay.length, source: streamEvents ? 'redis-stream' : 'database' })
  return replay ?? []
}
