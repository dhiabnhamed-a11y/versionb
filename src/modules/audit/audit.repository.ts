import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import type { DomainEvent } from '@/modules/events/event-bus'
import { toJsonValue } from '@/modules/shared/json'
import { logger } from '@/modules/shared/logger'

export async function recordAuditForEvent(event: DomainEvent) {
  if (!event.companyId) return null

  try {
    return await prisma.auditLog.create({
      data: {
        companyId: event.companyId,
        actorId: event.actorId ?? null,
        action: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        before: toJsonValue(event.before),
        after: toJsonValue(event.after),
        metadata: toJsonValue({ eventId: event.id, payload: event.payload, metadata: event.metadata }),
      },
    })
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      logger.warn('audit.write_skipped_missing_schema', { eventId: event.id, eventType: event.type })
      return null
    }

    throw error
  }
}
