import { createHash } from 'crypto'
import { conflict } from '@/modules/shared/errors'

type IdempotencyRecord<T> = {
  bodyHash: string
  expiresAt: number
  response: T
}

const records = new Map<string, IdempotencyRecord<unknown>>()

export function getIdempotencyKey(req: Request) {
  return req.headers.get('Idempotency-Key')?.trim() || null
}

export function hashIdempotencyBody(body: unknown) {
  return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex')
}

function prune(now: number) {
  if (records.size < 1000) return
  for (const [key, value] of records) {
    if (value.expiresAt <= now) records.delete(key)
  }
}

export async function runIdempotent<T>(
  key: string | null,
  body: unknown,
  work: () => Promise<T>,
  options: { ttlMs?: number } = {}
): Promise<T> {
  if (!key) return work()

  const now = Date.now()
  prune(now)
  const bodyHash = hashIdempotencyBody(body)
  const existing = records.get(key)
  if (existing && existing.expiresAt > now) {
    if (existing.bodyHash !== bodyHash) throw conflict('Idempotency key was reused with a different request body.')
    return existing.response as T
  }

  const response = await work()
  records.set(key, {
    bodyHash,
    expiresAt: now + (options.ttlMs ?? 24 * 60 * 60 * 1000),
    response,
  })
  return response
}
