import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { realtimeDeliveryJobSchema, type RealtimeEnvelope } from '@/modules/realtime/events/contracts'
import { getRealtimeConsumerOffset, loadRealtimeEventLogReplay, recordRealtimeConsumerOffset } from '@/modules/realtime/events/event-log'
import { recordRealtimeMetric } from '@/modules/realtime/metrics/metrics'
import { logger } from '@/modules/shared/logger'

const DEFAULT_REPLAY_LIMIT = Math.max(Number(process.env.REALTIME_REPLAY_LIMIT ?? 100), 10)

export async function recordSocketRecoveryOffset(userId: string, eventId: string, workspaceId?: string | null) {
  await recordRealtimeConsumerOffset({ userId, eventId, workspaceId })
  logger.debug('realtime.recovery_offset', { userId, workspaceId, eventId })
}

export async function loadMissedRealtimeEvents(input: {
  workspaceId: string | null | undefined
  afterEventId?: string | null
  userId?: string | null
  limit?: number
}): Promise<RealtimeEnvelope[]> {
  if (!input.workspaceId) return []
  const limit = Math.min(input.limit ?? DEFAULT_REPLAY_LIMIT, DEFAULT_REPLAY_LIMIT)
  const afterEventId =
    input.afterEventId ?? (input.userId ? await getRealtimeConsumerOffset({ userId: input.userId, workspaceId: input.workspaceId }).catch(() => null) : null)

  const eventLogReplay = await loadRealtimeEventLogReplay({
    workspaceId: input.workspaceId,
    afterEventId,
    limit,
  })
  if (eventLogReplay.length) return eventLogReplay

  try {
    const rows = await prisma.jobRun.findMany({
      where: {
        companyId: input.workspaceId,
        queue: 'realtime-delivery',
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { payload: true },
    })

    const events = rows
      .map((row) => {
        const parsed = realtimeDeliveryJobSchema.safeParse(row.payload)
        return parsed.success ? parsed.data.envelope : null
      })
      .filter((event): event is RealtimeEnvelope => Boolean(event))
      .reverse()

    const afterIndex = afterEventId ? events.findIndex((event) => event.id === afterEventId) : -1
    const replay = afterIndex >= 0 ? events.slice(afterIndex + 1) : events
    if (replay.length) recordRealtimeMetric('event.replayed', { workspaceId: input.workspaceId, count: replay.length })
    return replay
  } catch (error) {
    if (!isMissingDatabaseObjectError(error)) logger.error('realtime.recovery_load_failed', error, { workspaceId: input.workspaceId })
    return []
  }
}
