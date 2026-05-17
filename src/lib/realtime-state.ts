export type EntityWithId = { id: string }

export type RealtimeEntityPatch<T extends EntityWithId = EntityWithId> = {
  entityType: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  changed: Partial<T>
  removed?: string[]
}

export function applyRealtimeEntityPatch<T extends EntityWithId>(items: T[], patch: RealtimeEntityPatch<T>) {
  if (patch.operation === 'delete') return items.filter((item) => item.id !== patch.entityId)

  const index = items.findIndex((item) => item.id === patch.entityId)
  if (index < 0) return items

  const next = [...items]
  const updated = { ...next[index], ...patch.changed } as T & Record<string, unknown>
  for (const key of patch.removed ?? []) delete updated[key]
  next[index] = updated as T
  return next
}

export async function runOptimisticMutation<T>(input: {
  apply: () => void
  rollback: () => void
  commit: () => Promise<T>
  reconcile?: (result: T) => void
}) {
  input.apply()
  try {
    const result = await input.commit()
    input.reconcile?.(result)
    return result
  } catch (error) {
    input.rollback()
    throw error
  }
}
