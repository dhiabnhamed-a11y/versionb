import { z } from 'zod'
import { REALTIME_EVENTS, canonicalRealtimeEventName, type RealtimeEventName } from '@/lib/realtime-events'

export const REALTIME_CONTRACT_VERSION = 1

export const realtimeEventNameSchema = z.enum(REALTIME_EVENTS)

export const realtimeEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: realtimeEventNameSchema,
  workspaceId: z.string().min(1).nullable(),
  entityId: z.string().min(1).nullable().optional(),
  actorId: z.string().min(1).nullable().optional(),
  timestamp: z.string().datetime(),
  payload: z.unknown(),
  version: z.number().int().positive().default(REALTIME_CONTRACT_VERSION),
  correlationId: z.string().min(1).max(128).nullable().optional(),
})

export const realtimeDeliveryJobSchema = z.object({
  envelope: realtimeEnvelopeSchema,
  target: z.discriminatedUnion('scope', [
    z.object({ scope: z.literal('workspace'), workspaceId: z.string().min(1) }),
    z.object({ scope: z.literal('user'), userId: z.string().min(1) }),
  ]),
  emitLegacyEvent: z.boolean().default(true),
  queuedAt: z.string().datetime(),
})

export type RealtimeEnvelope = z.infer<typeof realtimeEnvelopeSchema>
export type RealtimeDeliveryJob = z.infer<typeof realtimeDeliveryJobSchema>
export type RealtimeDeliveryTarget = RealtimeDeliveryJob['target']

function makeEventId(type: RealtimeEventName) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `rt_${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function buildRealtimeEnvelope(input: {
  type: RealtimeEventName
  workspaceId?: string | null
  entityId?: string | null
  actorId?: string | null
  payload: unknown
  correlationId?: string | null
  id?: string
  timestamp?: string
}): RealtimeEnvelope {
  const type = canonicalRealtimeEventName(input.type)
  return realtimeEnvelopeSchema.parse({
    id: input.id ?? makeEventId(input.type),
    type,
    workspaceId: input.workspaceId ?? null,
    entityId: input.entityId ?? null,
    actorId: input.actorId ?? null,
    timestamp: input.timestamp ?? new Date().toISOString(),
    payload: input.payload,
    version: REALTIME_CONTRACT_VERSION,
    correlationId: input.correlationId ?? null,
  })
}

export function workspaceRoom(workspaceId: string) {
  return `company:${workspaceId}`
}

export function userRoom(userId: string) {
  return `user:${userId}`
}

export function channelRoom(workspaceId: string, channelId: string) {
  return `company:${workspaceId}:channel:${channelId}`
}
