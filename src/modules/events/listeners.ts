import type { RealtimeEventName } from '@/lib/realtime-events'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { logClientActivity } from '@/lib/clients'
import type { DomainEvent, DomainEventName } from '@/modules/events/event-bus'
import { subscribeDomainEvent } from '@/modules/events/event-bus'
import { buildRealtimeEntityPatch } from '@/modules/realtime/events/delta'
import { recordActivityForEvent } from '@/modules/activity/activity.repository'
import { recordAuditForEvent } from '@/modules/audit/audit.repository'
import { syncSearchIndexForEvent } from '@/modules/search/search.repository'
import { enqueueOperationalJob } from '@/modules/jobs/job-queue'

const listenerState = globalThis as typeof globalThis & {
  __taskitEnterpriseListenersRegistered?: boolean
}

const REALTIME_EVENT_MAP: Partial<Record<DomainEventName, RealtimeEventName>> = {
  'task.created': 'task_created',
  'task.updated': 'task_updated',
  'task.deleted': 'task_deleted',
  'invoice.created': 'invoice_created',
  'invoice.updated': 'invoice_updated',
  'invoice.deleted': 'invoice_deleted',
  'invoice.paid': 'invoice_updated',
  'approval.completed': 'approval.completed',
  'notification.created': 'notification.created',
  'notification.read': 'notification.read',
  'team.member.assigned': 'team.member.assigned',
  'ai.action.completed': 'ai.run.completed',
  'ai.run.completed': 'ai.run.completed',
  'enterprise.asset.updated': 'asset.updated',
  'enterprise.incident.created': 'incident.created',
  'enterprise.incident.updated': 'incident.updated',
  'client.created': 'client_created',
  'client.updated': 'client_updated',
  'client.deleted': 'client_deleted',
  'comment.created': 'comment_created',
}

function realtimePayloadForEvent(event: DomainEvent) {
  const base = event.payload ?? { entityId: event.entityId }
  const patch = buildRealtimeEntityPatch(event)
  if (!patch || !base || typeof base !== 'object' || Array.isArray(base)) return base
  return { ...base, realtimePatch: patch }
}

function invoiceActivityTitle(event: DomainEvent, invoice: Record<string, unknown>) {
  const number = typeof invoice.invoiceNumber === 'string' ? invoice.invoiceNumber : 'Invoice'
  if (event.type === 'invoice.created') return `${number} created`
  if (event.type === 'invoice.deleted') return `${number} deleted`
  if (event.type === 'invoice.paid') return `${number} paid`
  if (event.type === 'invoice.updated') return `${number} updated`
  return `${number} changed`
}

async function mirrorInvoiceClientActivity(event: DomainEvent) {
  if (!event.type.startsWith('invoice.')) return
  const payload = event.payload as { invoice?: Record<string, unknown> } | undefined
  const invoice = payload?.invoice
  const clientId = typeof invoice?.clientId === 'string' ? invoice.clientId : null
  if (!event.companyId || !invoice || !clientId) return

  await logClientActivity({
    companyId: event.companyId,
    clientId,
    actorId: event.actorId ?? null,
    type: event.type,
    title: invoiceActivityTitle(event, invoice),
    metadata: {
      eventId: event.id,
      invoiceId: event.entityId,
      status: typeof invoice.status === 'string' ? invoice.status : undefined,
      total: typeof invoice.total === 'number' ? invoice.total : undefined,
    },
  })
}

export function registerEnterpriseEventListeners() {
  if (listenerState.__taskitEnterpriseListenersRegistered) return
  listenerState.__taskitEnterpriseListenersRegistered = true

  subscribeDomainEvent('*', async (event) => {
    await Promise.all([
      recordActivityForEvent(event),
      recordAuditForEvent(event),
      syncSearchIndexForEvent(event),
      mirrorInvoiceClientActivity(event),
      enqueueOperationalJob({
        queue: 'operations',
        name: 'analytics.ingest-event',
        companyId: event.companyId,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: {
          companyId: event.companyId,
          eventType: event.type,
          entityType: event.entityType,
          entityId: event.entityId,
          occurredAt: event.occurredAt,
        },
        maxAttempts: 5,
      }),
    ])

    const realtimeEvent = REALTIME_EVENT_MAP[event.type]
    if (realtimeEvent) {
      emitCompanyRealtime(event.companyId, realtimeEvent, realtimePayloadForEvent(event))
    }
  })
}
