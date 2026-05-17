import type { DomainEvent } from '@/modules/events/event-bus'

export type RealtimePatchOperation = 'create' | 'update' | 'delete'

export type RealtimeEntityPatch = {
  entityType: string
  entityId: string
  operation: RealtimePatchOperation
  changed: Record<string, unknown>
  removed: string[]
  version: number
  eventId: string
  occurredAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function operationFromEvent(type: string): RealtimePatchOperation {
  if (type.endsWith('.created')) return 'create'
  if (type.endsWith('.deleted')) return 'delete'
  return 'update'
}

function shallowDiff(before: unknown, after: unknown) {
  if (!isRecord(after)) return { changed: {}, removed: [] }
  if (!isRecord(before)) return { changed: after, removed: [] }

  const changed: Record<string, unknown> = {}
  const removed: string[] = []

  for (const [key, value] of Object.entries(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(value)) changed[key] = value
  }

  for (const key of Object.keys(before)) {
    if (!(key in after)) removed.push(key)
  }

  return { changed, removed }
}

export function buildRealtimeEntityPatch(event: DomainEvent): RealtimeEntityPatch | null {
  const operation = operationFromEvent(event.type)
  const diff = operation === 'delete' ? { changed: {}, removed: [] } : shallowDiff(event.before, event.after)

  if (operation === 'update' && Object.keys(diff.changed).length === 0 && diff.removed.length === 0) return null

  return {
    entityType: event.entityType,
    entityId: event.entityId,
    operation,
    changed: diff.changed,
    removed: diff.removed,
    version: event.version,
    eventId: event.id,
    occurredAt: event.occurredAt,
  }
}
