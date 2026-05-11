import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import type { DomainEvent } from '@/modules/events/event-bus'
import { logger } from '@/modules/shared/logger'
import { toJsonValue } from '@/modules/shared/json'

export type SearchResult = {
  id: string
  entityType: string
  entityId: string
  title: string
  subtitle?: string | null
  href?: string | null
}

function hrefForEvent(event: DomainEvent) {
  if (event.entityType === 'task') {
    const projectId = (event.payload as { projectId?: string; project?: { id?: string } } | undefined)?.projectId ??
      (event.payload as { project?: { id?: string } } | undefined)?.project?.id
    return projectId ? `/dashboard/admin/projects/${projectId}` : '/dashboard/admin/tasks'
  }
  if (event.entityType === 'invoice') return '/dashboard/admin/invoices'
  if (event.entityType === 'client') return `/dashboard/admin/clients/${event.entityId}`
  if (event.entityType === 'project') return `/dashboard/admin/projects/${event.entityId}`
  return null
}

function titleForEvent(event: DomainEvent) {
  const payload = event.payload as Record<string, unknown> | undefined
  const nested = payload?.[event.entityType] as Record<string, unknown> | undefined
  const source = nested ?? payload
  const title = source?.title ?? source?.invoiceNumber ?? source?.companyName ?? source?.name
  return typeof title === 'string' && title.trim() ? title.trim() : `${event.entityType} ${event.entityId}`
}

export async function syncSearchIndexForEvent(event: DomainEvent) {
  if (!event.companyId) return null
  if (event.type.endsWith('.deleted')) {
    try {
      await prisma.searchIndex.deleteMany({
        where: { companyId: event.companyId, entityType: event.entityType, entityId: event.entityId },
      })
    } catch (error) {
      if (!isMissingDatabaseObjectError(error)) throw error
      logger.warn('search.delete_skipped_missing_schema', { eventId: event.id, eventType: event.type })
    }
    return null
  }

  try {
    return await prisma.searchIndex.upsert({
      where: {
        companyId_entityType_entityId: {
          companyId: event.companyId,
          entityType: event.entityType,
          entityId: event.entityId,
        },
      },
      create: {
        companyId: event.companyId,
        entityType: event.entityType,
        entityId: event.entityId,
        title: titleForEvent(event),
        subtitle: event.action ?? event.type,
        content: JSON.stringify(toJsonValue(event.payload) ?? {}),
        href: hrefForEvent(event),
        metadata: toJsonValue({ eventId: event.id, eventType: event.type }),
      },
      update: {
        title: titleForEvent(event),
        subtitle: event.action ?? event.type,
        content: JSON.stringify(toJsonValue(event.payload) ?? {}),
        href: hrefForEvent(event),
        metadata: toJsonValue({ eventId: event.id, eventType: event.type }),
      },
    })
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      logger.warn('search.index_skipped_missing_schema', { eventId: event.id, eventType: event.type })
      return null
    }

    throw error
  }
}

export async function searchWorkspaceIndex(companyId: string, query: string, limit = 12): Promise<SearchResult[]> {
  const needle = query.trim()
  if (!needle) return []

  try {
    const rows = await prisma.searchIndex.findMany({
      where: {
        companyId,
        OR: [
          { title: { contains: needle, mode: 'insensitive' } },
          { subtitle: { contains: needle, mode: 'insensitive' } },
          { content: { contains: needle, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        title: true,
        subtitle: true,
        href: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })

    return rows
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) return []
    throw error
  }
}
