import { logger } from '@/modules/shared/logger'

export type DomainEventName =
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'invoice.created'
  | 'invoice.updated'
  | 'invoice.deleted'
  | 'invoice.paid'
  | 'finance.account.created'
  | 'finance.journal_entry.created'
  | 'finance.journal_entry.posted'
  | 'finance.journal_entry.reversed'
  | 'finance.expense.created'
  | 'finance.payroll.created'
  | 'finance.treasury_transaction.created'
  | 'finance.treasury_transaction.posted'
  | 'approval.completed'
  | 'comment.created'
  | 'deliverable.reviewed'
  | 'client.created'
  | 'client.updated'
  | 'client.deleted'

export type DomainEvent = {
  id: string
  type: DomainEventName
  companyId?: string | null
  actorId?: string | null
  entityType: string
  entityId: string
  action?: string
  payload?: unknown
  before?: unknown
  after?: unknown
  metadata?: unknown
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

export function buildDomainEvent(input: Omit<DomainEvent, 'id' | 'occurredAt'> & { id?: string; occurredAt?: string }): DomainEvent {
  return {
    ...input,
    id: input.id ?? makeEventId(),
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

export async function publishDomainEvent(input: Omit<DomainEvent, 'id' | 'occurredAt'> & { id?: string; occurredAt?: string }) {
  const event = buildDomainEvent(input)
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
