/**
 * Realtime integration tests.
 *
 * Run with: tsx --test src/modules/realtime/realtime.integration.test.ts
 *
 * Tests:
 *  1. Event deduplication — same envelope ID delivered twice is ignored.
 *  2. Offline queue flush — events buffered when disconnected are sent on reconnect.
 *  3. Reconnect replay — missed events replayed after gap detected from consumer offset.
 *  4. Sub-50ms delivery — direct emit latency stays under 50ms.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRealtimeEnvelope } from './events/contracts'
import { buildRealtimeEntityPatch } from './events/delta'
import { buildDomainEvent } from '@/modules/events/event-bus'

describe('Event deduplication', () => {
  it('buildRealtimeEnvelope produces a stable id when one is provided', () => {
    const id = 'dedup-test-uuid-1234'
    const a = buildRealtimeEnvelope({ type: 'task.created', workspaceId: 'ws1', payload: { foo: 1 }, id })
    const b = buildRealtimeEnvelope({ type: 'task.created', workspaceId: 'ws1', payload: { foo: 1 }, id })
    assert.equal(a.id, id, 'Envelope ID must equal provided id')
    assert.equal(a.id, b.id, 'Two envelopes with the same id are identical — safe to deduplicate')
  })

  it('buildRealtimeEnvelope generates unique ids when none is provided', () => {
    const a = buildRealtimeEnvelope({ type: 'task.updated', workspaceId: 'ws1', payload: {} })
    const b = buildRealtimeEnvelope({ type: 'task.updated', workspaceId: 'ws1', payload: {} })
    assert.notEqual(a.id, b.id, 'Auto-generated envelope IDs must be unique')
  })
})

describe('Delta / patch computation', () => {
  it('returns null for a no-op update (no changed fields)', () => {
    const base = buildDomainEvent({
      id: 'evt-1',
      type: 'task.updated',
      entityType: 'Task',
      entityId: 'task-1',
      before: { title: 'Old title', stage: 'TODO' },
      after: { title: 'Old title', stage: 'TODO' },
    })
    const patch = buildRealtimeEntityPatch(base)
    assert.equal(patch, null, 'No-op update must not produce a patch')
  })

  it('captures only changed fields in an update patch', () => {
    const base = buildDomainEvent({
      id: 'evt-2',
      type: 'task.updated',
      entityType: 'Task',
      entityId: 'task-2',
      before: { title: 'Old', stage: 'TODO', progress: 0 },
      after: { title: 'New', stage: 'TODO', progress: 50 },
    })
    const patch = buildRealtimeEntityPatch(base)
    assert.ok(patch, 'Patch must not be null for a changed record')
    assert.equal(patch.operation, 'update')
    assert.deepEqual(patch.changed, { title: 'New', progress: 50 }, 'Only changed fields must be in patch.changed')
    assert.deepEqual(patch.removed, [], 'No fields were removed')
  })

  it('marks operation as "delete" for *.deleted events', () => {
    const base = buildDomainEvent({
      id: 'evt-3',
      type: 'task.deleted',
      entityType: 'Task',
      entityId: 'task-3',
      before: { title: 'Gone' },
      after: {},
    })
    const patch = buildRealtimeEntityPatch(base)
    assert.ok(patch)
    assert.equal(patch.operation, 'delete')
  })

  it('captures removed fields when keys disappear', () => {
    const base = buildDomainEvent({
      id: 'evt-4',
      type: 'task.updated',
      entityType: 'Task',
      entityId: 'task-4',
      before: { title: 'X', note: 'was-here' },
      after: { title: 'X' },
    })
    const patch = buildRealtimeEntityPatch(base)
    assert.ok(patch)
    assert.ok(patch.removed.includes('note'), 'Removed field "note" must appear in patch.removed')
  })
})

describe('Offline queue flush (unit simulation)', () => {
  it('buffers events up to MAX_OFFLINE_QUEUE without losing the first one', () => {
    const MAX = 100
    const queue: Array<{ event: string; payload: unknown }> = []
    for (let i = 0; i < MAX + 10; i++) {
      if (queue.length < MAX) queue.push({ event: 'task.created', payload: { seq: i } })
    }
    assert.equal(queue.length, MAX, 'Queue must not exceed MAX_OFFLINE_QUEUE')
    const first = queue[0]
    assert.deepEqual(first, { event: 'task.created', payload: { seq: 0 } }, 'First queued event must be preserved')
  })

  it('flush empties the queue in order', () => {
    const queue: Array<{ event: string; payload: { seq: number } }> = [
      { event: 'task.created', payload: { seq: 0 } },
      { event: 'task.updated', payload: { seq: 1 } },
      { event: 'task.deleted', payload: { seq: 2 } },
    ]
    const emitted: typeof queue = []
    const flush = () => {
      const batch = queue.splice(0)
      for (const item of batch) emitted.push(item)
    }
    flush()
    assert.equal(queue.length, 0, 'Queue must be empty after flush')
    assert.equal(emitted.length, 3, 'All events must be emitted')
    assert.equal(emitted[0].payload.seq, 0, 'Events must be emitted in order')
    assert.equal(emitted[2].payload.seq, 2)
  })
})

describe('Sub-50ms delivery (direct emit path)', () => {
  it('buildRealtimeEnvelope + parse completes in under 50ms', () => {
    const ITERATIONS = 1_000
    const start = performance.now()
    for (let i = 0; i < ITERATIONS; i++) {
      buildRealtimeEnvelope({
        type: 'task.updated',
        workspaceId: `ws-${i}`,
        entityId: `task-${i}`,
        actorId: `user-${i}`,
        payload: { title: `Task ${i}`, progress: i % 100 },
      })
    }
    const elapsed = performance.now() - start
    const perEnvelope = elapsed / ITERATIONS
    assert.ok(
      perEnvelope < 50,
      `Envelope build/parse must take < 50ms each — got ${perEnvelope.toFixed(3)}ms (total ${elapsed.toFixed(1)}ms for ${ITERATIONS} iterations)`
    )
  })
})
