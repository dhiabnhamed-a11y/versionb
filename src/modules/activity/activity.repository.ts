import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import type { DomainEvent } from '@/modules/events/event-bus'
import { logger } from '@/modules/shared/logger'
import { toJsonValue } from '@/modules/shared/json'

function actionForEvent(event: DomainEvent) {
  if (event.action) return event.action
  return event.type
    .split('.')
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ')
}

export async function recordActivityForEvent(event: DomainEvent) {
  if (!event.companyId) return null

  try {
    return await prisma.activity.create({
      data: {
        companyId: event.companyId,
        entityType: event.entityType,
        entityId: event.entityId,
        taskId: event.entityType === 'task' ? event.entityId : null,
        userId: event.actorId ?? null,
        action: actionForEvent(event),
        metadata: toJsonValue({ eventId: event.id, type: event.type, payload: event.payload, metadata: event.metadata }),
        source: 'event_bus',
      },
    })
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      logger.warn('activity.write_skipped_missing_schema', { eventId: event.id, eventType: event.type })
      return null
    }

    throw error
  }
}
