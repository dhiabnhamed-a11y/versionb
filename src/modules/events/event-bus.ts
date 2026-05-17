import { logger } from '@/modules/shared/logger'
import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { toJsonValue } from '@/modules/shared/json'

export type DomainEventName =
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'invoice.created'
  | 'invoice.updated'
  | 'invoice.deleted'
  | 'invoice.paid'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'finance.account.created'
  | 'finance.journal_entry.created'
  | 'finance.journal_entry.posted'
  | 'finance.journal_entry.reversed'
  | 'finance.expense.created'
  | 'finance.payroll.created'
  | 'finance.treasury_transaction.created'
  | 'finance.treasury_transaction.posted'
  | 'approval.completed'
  | 'notification.created'
  | 'notification.read'
  | 'comment.created'
  | 'team.member.assigned'
  | 'deliverable.reviewed'
  | 'client.created'
  | 'client.updated'
  | 'client.deleted'
  | 'contract.generated'
  | 'contract.signed'
  | 'ai.action.completed'
  | 'ai.run.completed'
  | 'enterprise.asset.created'
  | 'enterprise.asset.updated'
  | 'enterprise.incident.created'
  | 'enterprise.incident.updated'
  | 'enterprise.maintenance.created'
  | 'enterprise.maintenance.updated'

export type DomainEvent = {
  id: string
  type: DomainEventName
  version: number
  idempotencyKey: string
  companyId?: string | null
  actorId?: string | null
  entityType: string
  entityId: string
  action?: string
  payload?: unknown
  before?: unknown
  after?: unknown
  metadata?: unknown
  correlationId?: string | null
  occurredAt: string
}

type Listener = (event: DomainEvent) => Promise<void> | void

type EventBusState = {
  listeners: Map<DomainEventName | '*', Set<Listener>>
}

const globalBus = globalThis as typeof globalThis & {
  __taskitEventBus?: EventBusState
}

function getState() {
  if (!globalBus.__taskitEventBus) {
    globalBus.__taskitEventBus = { listeners: new Map() }
  }
  return globalBus.__taskitEventBus
}

function makeEventId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function makeIdempotencyKey(input: Omit<DomainEvent, 'id' | 'occurredAt' | 'version' | 'idempotencyKey'> & { id?: string; idempotencyKey?: string }) {
  return input.idempotencyKey || [input.type, input.companyId, input.entityType, input.entityId, input.action].filter(Boolean).join(':')
}

export function buildDomainEvent(
  input: Omit<DomainEvent, 'id' | 'occurredAt' | 'version' | 'idempotencyKey'> & {
    id?: string
    occurredAt?: string
    version?: number
    idempotencyKey?: string
  }
): DomainEvent {
  return {
    ...input,
    id: input.id ?? makeEventId(),
    version: input.version ?? 1,
    idempotencyKey: makeIdempotencyKey(input),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  }
}

export function subscribeDomainEvent(type: DomainEventName | '*', listener: Listener) {
  const state = getState()
  const listeners = state.listeners.get(type) ?? new Set<Listener>()
  listeners.add(listener)
  state.listeners.set(type, listeners)

  return () => listeners.delete(listener)
}

async function recordDurableEvent(event: DomainEvent) {
  try {
    await prisma.jobRun.create({
      data: {
        companyId: event.companyId ?? null,
        queue: 'domain-events',
        name: event.type,
        status: 'PUBLISHED',
        maxAttempts: 1,
        externalId: event.idempotencyKey,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: toJsonValue(event),
        finishedAt: new Date(event.occurredAt),
      },
    })
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      logger.warn('event.durable_record_skipped_missing_schema', { eventId: event.id, eventType: event.type })
      return
    }

    logger.error('event.durable_record_failed', error, { eventId: event.id, eventType: event.type })
  }
}

export async function publishDomainEvent(
  input: Omit<DomainEvent, 'id' | 'occurredAt' | 'version' | 'idempotencyKey'> & {
    id?: string
    occurredAt?: string
    version?: number
    idempotencyKey?: string
  }
) {
  const event = buildDomainEvent(input)
  await recordDurableEvent(event)
  const state = getState()
  const listeners = [...(state.listeners.get(event.type) ?? []), ...(state.listeners.get('*') ?? [])]
  const results = await Promise.allSettled(listeners.map((listener) => listener(event)))

  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error('event.listener_failed', result.reason, { eventId: event.id, eventType: event.type })
    }
  }

  return event
}
