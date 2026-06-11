import { tenantQueryRaw } from '@/lib/tenant/tenant-raw-query';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/db'
import { badRequest, unauthorized } from '@/modules/shared/errors'

export type SignedRequestInput = {
  body: string
  headers: Pick<Headers, 'get'>
  method: string
  namespace: string
  pathname: string
  secret: string
  toleranceMs?: number
}

export type ReplayNonceInput = {
  namespace: string
  nonce: string
  expiresAt?: Date
}

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000

function safeCompare(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function cleanSignature(value: string | null) {
  return value?.trim().replace(/^sha256=/i, '') ?? ''
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function buildSignedRequestPayload(input: {
  body: string
  method: string
  nonce: string
  pathname: string
  timestamp: string
}) {
  return [input.timestamp, input.nonce, input.method.toUpperCase(), input.pathname, sha256(input.body)].join('.')
}

export function signRequestPayload(secret: string, payload: string) {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function assertTimestampTolerance(timestamp: string | null, toleranceMs = DEFAULT_TOLERANCE_MS) {
  if (!timestamp) throw badRequest('Missing request timestamp.')
  const parsed = Number(timestamp)
  const timestampMs = Number.isFinite(parsed) && parsed > 10_000_000_000 ? parsed : Date.parse(timestamp)
  if (!Number.isFinite(timestampMs)) throw badRequest('Invalid request timestamp.')

  const skew = Math.abs(Date.now() - timestampMs)
  if (skew > toleranceMs) throw unauthorized('Request timestamp is outside the allowed replay window.')

  return new Date(timestampMs)
}

export async function storeReplayNonce(input: ReplayNonceInput) {
  const nonceHash = sha256(input.nonce)
  const expiresAt = input.expiresAt ?? new Date(Date.now() + DEFAULT_TOLERANCE_MS)
  const rows = await tenantQueryRaw<{ id: string }[]>`
    INSERT INTO "security_nonces" ("id", "namespace", "nonceHash", "expiresAt", "createdAt")
    VALUES (${randomUUID()}, ${input.namespace}, ${nonceHash}, ${expiresAt}, NOW())
    ON CONFLICT ("namespace", "nonceHash") DO NOTHING
    RETURNING "id"
  `

  if (rows.length === 0) throw unauthorized('Replay detected.')
}

export async function verifySignedRequest(input: SignedRequestInput) {
  if (!input.secret) throw unauthorized('Request signature is not configured.')

  const timestamp = input.headers.get('x-taskit-timestamp') ?? input.headers.get('x-signature-timestamp')
  const nonce = input.headers.get('x-taskit-nonce') ?? input.headers.get('x-request-nonce')
  const signature = cleanSignature(input.headers.get('x-taskit-signature') ?? input.headers.get('x-signature'))

  if (!nonce) throw badRequest('Missing request nonce.')
  if (!signature) throw unauthorized('Missing request signature.')

  const timestampDate = assertTimestampTolerance(timestamp, input.toleranceMs)
  const payload = buildSignedRequestPayload({
    body: input.body,
    method: input.method,
    nonce,
    pathname: input.pathname,
    timestamp: timestamp ?? '',
  })
  const expected = signRequestPayload(input.secret, payload)

  if (!safeCompare(signature, expected)) throw unauthorized('Invalid request signature.')

  await storeReplayNonce({
    namespace: input.namespace,
    nonce,
    expiresAt: new Date(timestampDate.getTime() + (input.toleranceMs ?? DEFAULT_TOLERANCE_MS)),
  })
}
