import assert from 'node:assert/strict'
import test from 'node:test'
import { AppError } from '@/modules/shared/errors'
import {
  hashIdempotencyBody,
  type IdempotencyRecord,
  type IdempotencyStore,
  runIdempotentWithStore,
} from '@/lib/idempotency'

class MemoryIdempotencyStore implements IdempotencyStore {
  records = new Map<string, IdempotencyRecord>()

  key(companyId: string, idempotencyKey: string) {
    return `${companyId}:${idempotencyKey}`
  }

  async complete(input: { bodyHash: string; companyId: string; key: string; response: unknown }) {
    this.records.set(this.key(input.companyId, input.key), {
      bodyHash: input.bodyHash,
      expiresAt: this.records.get(this.key(input.companyId, input.key))?.expiresAt ?? new Date(Date.now() + 60_000),
      response: input.response,
      status: 'COMPLETED',
    })
  }

  async createProcessing(input: { bodyHash: string; companyId: string; expiresAt: Date; key: string }) {
    const recordKey = this.key(input.companyId, input.key)
    if (this.records.has(recordKey)) throw { code: 'P2002' }
    this.records.set(recordKey, {
      bodyHash: input.bodyHash,
      expiresAt: input.expiresAt,
      response: null,
      status: 'PROCESSING',
    })
  }

  async deleteExpired(input: { companyId: string; now: Date }) {
    for (const [recordKey, record] of this.records) {
      if (recordKey.startsWith(`${input.companyId}:`) && record.expiresAt <= input.now) this.records.delete(recordKey)
    }
  }

  async fail(input: { bodyHash: string; companyId: string; error: string; key: string }) {
    this.records.set(this.key(input.companyId, input.key), {
      bodyHash: input.bodyHash,
      expiresAt: this.records.get(this.key(input.companyId, input.key))?.expiresAt ?? new Date(Date.now() + 60_000),
      response: { error: input.error },
      status: 'FAILED',
    })
  }

  async find(input: { companyId: string; key: string }) {
    return this.records.get(this.key(input.companyId, input.key)) ?? null
  }
}

test('hashIdempotencyBody is stable for equivalent object bodies', () => {
  assert.equal(hashIdempotencyBody({ a: 1, b: { c: 2 } }), hashIdempotencyBody({ b: { c: 2 }, a: 1 }))
})

test('runIdempotentWithStore replays the persisted response for the same tenant, key, and body', async () => {
  const store = new MemoryIdempotencyStore()
  let calls = 0

  const first = await runIdempotentWithStore(store, 'create-client', { name: 'Acme' }, async () => {
    calls += 1
    return { id: 'client_1' }
  }, { companyId: 'company_1', route: '/api/v1/clients' })

  const second = await runIdempotentWithStore(store, 'create-client', { name: 'Acme' }, async () => {
    calls += 1
    return { id: 'client_2' }
  }, { companyId: 'company_1', route: '/api/v1/clients' })

  assert.deepEqual(first, { id: 'client_1' })
  assert.deepEqual(second, { id: 'client_1' })
  assert.equal(calls, 1)
})

test('runIdempotentWithStore scopes keys by tenant', async () => {
  const store = new MemoryIdempotencyStore()
  let calls = 0

  await runIdempotentWithStore(store, 'shared-key', { name: 'Acme' }, async () => {
    calls += 1
    return { id: 'company_1_record' }
  }, { companyId: 'company_1', route: '/api/v1/clients' })

  const result = await runIdempotentWithStore(store, 'shared-key', { name: 'Acme' }, async () => {
    calls += 1
    return { id: 'company_2_record' }
  }, { companyId: 'company_2', route: '/api/v1/clients' })

  assert.deepEqual(result, { id: 'company_2_record' })
  assert.equal(calls, 2)
})

test('runIdempotentWithStore rejects key reuse with a different body', async () => {
  const store = new MemoryIdempotencyStore()

  await runIdempotentWithStore(store, 'create-client', { name: 'Acme' }, async () => ({ id: 'client_1' }), {
    companyId: 'company_1',
    route: '/api/v1/clients',
  })

  await assert.rejects(
    () =>
      runIdempotentWithStore(store, 'create-client', { name: 'Different' }, async () => ({ id: 'client_2' }), {
        companyId: 'company_1',
        route: '/api/v1/clients',
      }),
    (error) => error instanceof AppError && error.status === 409
  )
})

test('runIdempotentWithStore requires a tenant when a key is supplied', async () => {
  const store = new MemoryIdempotencyStore()

  await assert.rejects(
    () => runIdempotentWithStore(store, 'key', { value: true }, async () => ({ ok: true })),
    (error) => error instanceof AppError && error.status === 400
  )
})
