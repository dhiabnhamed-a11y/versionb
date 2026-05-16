import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { getPrismaErrorCode } from '@/lib/prisma-errors'
import { badRequest, conflict } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'

type IdempotencyStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED'

export type IdempotencyRecord = {
  bodyHash: string
  expiresAt: Date
  lockedUntil: Date | null
  response: unknown
  status: IdempotencyStatus | string
}

export type IdempotencyStore = {
  complete(input: { bodyHash: string; companyId: string; key: string; response: unknown; responseStatus?: number }): Promise<void>
  createProcessing(input: {
    bodyHash: string
    companyId: string
    expiresAt: Date
    key: string
    lockedUntil: Date
    method: string
    route: string
  }): Promise<void>
  deleteExpired(input: { companyId: string; now: Date }): Promise<void>
  fail(input: { bodyHash: string; companyId: string; error: string; key: string }): Promise<void>
  find(input: { companyId: string; key: string }): Promise<IdempotencyRecord | null>
  takeoverExpiredProcessing(input: {
    bodyHash: string
    companyId: string
    key: string
    lockedUntil: Date
    now: Date
    staleBefore: Date
  }): Promise<boolean>
}

export type IdempotencyOptions = {
  companyId?: string | null
  method?: string
  processingTtlMs?: number
  responseStatus?: number
  route?: string
  ttlMs?: number
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_PROCESSING_TTL_MS = 60 * 1000
const MAX_KEY_LENGTH = 255

export function getIdempotencyKey(req: Request) {
  return normalizeIdempotencyKey(req.headers.get('Idempotency-Key'))
}

export function normalizeIdempotencyKey(key: string | null | undefined) {
  const normalized = key?.trim()
  if (!normalized) return null
  if (normalized.length > MAX_KEY_LENGTH) throw badRequest('Idempotency-Key must be 255 characters or fewer.')
  return normalized
}

function normalizeForStableJson(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalizeForStableJson)
  if (typeof value === 'object') {
    if (typeof value.toString === 'function' && value.constructor?.name === 'Decimal') return value.toString()
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([entryKey, entryValue]) => [entryKey, normalizeForStableJson(entryValue)])
    )
  }
  return value
}

export function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForStableJson(value ?? null))
}

export function hashIdempotencyBody(body: unknown) {
  return createHash('sha256').update(stableStringify(body)).digest('hex')
}

function isUniqueConstraintError(error: unknown) {
  return getPrismaErrorCode(error) === 'P2002'
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

const prismaIdempotencyStore: IdempotencyStore = {
  async complete(input) {
    await prisma.idempotencyKey.update({
      where: { companyId_key: { companyId: input.companyId, key: input.key } },
      data: {
        response: toJsonValue(input.response),
        responseStatus: input.responseStatus ?? null,
        lockedUntil: null,
        lastSeenAt: new Date(),
        status: 'COMPLETED',
      },
    })
  },
  async createProcessing(input) {
    await prisma.idempotencyKey.create({
      data: {
        bodyHash: input.bodyHash,
        companyId: input.companyId,
        expiresAt: input.expiresAt,
        key: input.key,
        lockedUntil: input.lockedUntil,
        method: input.method,
        route: input.route,
      },
    })
  },
  async deleteExpired(input) {
    await prisma.idempotencyKey.deleteMany({
      where: {
        companyId: input.companyId,
        expiresAt: { lte: input.now },
      },
    })
  },
  async fail(input) {
    await prisma.idempotencyKey.update({
      where: { companyId_key: { companyId: input.companyId, key: input.key } },
      data: {
        error: input.error,
        lockedUntil: null,
        lastSeenAt: new Date(),
        status: 'FAILED',
      },
    })
  },
  async find(input) {
    return prisma.idempotencyKey.findUnique({
      where: { companyId_key: { companyId: input.companyId, key: input.key } },
      select: {
        bodyHash: true,
        expiresAt: true,
        lockedUntil: true,
        response: true,
        status: true,
      },
    })
  },
  async takeoverExpiredProcessing(input) {
    const result = await prisma.idempotencyKey.updateMany({
      where: {
        bodyHash: input.bodyHash,
        companyId: input.companyId,
        key: input.key,
        status: 'PROCESSING',
        OR: [{ lockedUntil: { lte: input.now } }, { lockedUntil: null, updatedAt: { lte: input.staleBefore } }],
      },
      data: {
        attempts: { increment: 1 },
        lastSeenAt: input.now,
        lockedUntil: input.lockedUntil,
      },
    })

    return result.count === 1
  },
}

export async function runIdempotentWithStore<T>(
  store: IdempotencyStore,
  key: string | null,
  body: unknown,
  work: () => Promise<T>,
  options: IdempotencyOptions = {}
): Promise<T> {
  const normalizedKey = normalizeIdempotencyKey(key)
  if (!normalizedKey) return work()

  const companyId = options.companyId?.trim()
  if (!companyId) throw badRequest('A workspace is required to use Idempotency-Key.')

  const now = new Date()
  const bodyHash = hashIdempotencyBody(body)
  const expiresAt = new Date(now.getTime() + (options.ttlMs ?? DEFAULT_TTL_MS))
  const processingTtlMs = options.processingTtlMs ?? DEFAULT_PROCESSING_TTL_MS
  const lockedUntil = new Date(now.getTime() + processingTtlMs)
  const staleBefore = new Date(now.getTime() - processingTtlMs)
  const method = options.method ?? 'POST'
  const route = options.route ?? 'unknown'

  await store.deleteExpired({ companyId, now })

  try {
    await store.createProcessing({ bodyHash, companyId, expiresAt, key: normalizedKey, lockedUntil, method, route })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error

    const existing = await store.find({ companyId, key: normalizedKey })
    if (!existing || existing.expiresAt <= now) {
      await store.deleteExpired({ companyId, now })
      await store.createProcessing({ bodyHash, companyId, expiresAt, key: normalizedKey, lockedUntil, method, route })
    } else {
      if (existing.bodyHash !== bodyHash) throw conflict('Idempotency key was reused with a different request body.')
      if (existing.status === 'COMPLETED') return existing.response as T
      if (existing.status === 'FAILED') throw conflict('Previous request with this Idempotency-Key failed. Use a new key to retry.')
      if (existing.status === 'PROCESSING') {
        const claimed = await store.takeoverExpiredProcessing({
          bodyHash,
          companyId,
          key: normalizedKey,
          lockedUntil,
          now,
          staleBefore,
        })
        if (claimed) return completeIdempotentWork(store, normalizedKey, bodyHash, companyId, work, options.responseStatus)
      }
      throw conflict('A request with this Idempotency-Key is already in progress.')
    }
  }

  return completeIdempotentWork(store, normalizedKey, bodyHash, companyId, work, options.responseStatus)
}

async function completeIdempotentWork<T>(
  store: IdempotencyStore,
  key: string,
  bodyHash: string,
  companyId: string,
  work: () => Promise<T>,
  responseStatus?: number
): Promise<T> {
  try {
    const response = await work()
    await store.complete({
      bodyHash,
      companyId,
      key,
      response,
      responseStatus,
    })
    return response
  } catch (error) {
    await store.fail({ bodyHash, companyId, error: errorMessage(error), key }).catch(() => undefined)
    throw error
  }
}

export async function runIdempotent<T>(
  key: string | null,
  body: unknown,
  work: () => Promise<T>,
  options: IdempotencyOptions = {}
): Promise<T> {
  return runIdempotentWithStore(prismaIdempotencyStore, key, body, work, options)
}
