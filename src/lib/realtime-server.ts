import type { RealtimeEventName } from './realtime-events'
import { enqueueRealtimeDelivery, emitRealtimeEnvelopeDirect } from '@/modules/realtime/events/delivery'
import { buildRealtimeEnvelope } from '@/modules/realtime/events/contracts'
import type { PresenceUser } from '@/modules/realtime/presence/presence-store'
import { logger } from '@/modules/shared/logger'

export type RealtimeUser = PresenceUser

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function pickFields(source: Record<string, unknown>, fields: string[]) {
  const picked: Record<string, unknown> = {}
  for (const field of fields) {
    if (source[field] !== undefined) picked[field] = source[field]
  }
  return picked
}

function compactWrappedRecord(payload: Record<string, unknown>, key: string, fields: string[]) {
  const value = payload[key]
  if (!isRecord(value)) return null
  return {
    ...pickFields(value, fields),
    [`${key}Id`]: typeof value.id === 'string' ? value.id : payload[`${key}Id`],
  }
}

function isEventFamily(type: RealtimeEventName, family: string) {
  return type.startsWith(`${family}_`) || type.startsWith(`${family}.`)
}

function compactRealtimePayload(type: RealtimeEventName, payload: unknown) {
  if (!isRecord(payload)) return payload

  const patch = payload.realtimePatch ? { realtimePatch: payload.realtimePatch } : {}
  const commonFields = ['id', 'name', 'title', 'status', 'stage', 'progress', 'companyId', 'projectId', 'taskId', 'clientId', 'assigneeId', 'createdAt', 'updatedAt']

  if (type === 'project_media_created' || type === 'project.media.created') {
    return {
      ...pickFields(payload, ['projectId']),
      ...(compactWrappedRecord(payload, 'media', [...commonFields, 'url', 'mimeType']) ?? {}),
    }
  }
  if (type === 'project_category_created' || type === 'project.category.created') return compactWrappedRecord(payload, 'category', commonFields) ?? payload
  if (isEventFamily(type, 'project')) return compactWrappedRecord(payload, 'project', commonFields) ?? payload
  if (isEventFamily(type, 'client')) return compactWrappedRecord(payload, 'client', commonFields) ?? payload
  if (isEventFamily(type, 'invoice')) return compactWrappedRecord(payload, 'invoice', [...commonFields, 'number', 'invoiceNumber', 'total', 'totalAmount', 'currency', 'paidAt']) ?? payload
  if (isEventFamily(type, 'comment')) {
    return {
      ...pickFields(payload, ['fileId', 'projectId', 'taskId']),
      ...(compactWrappedRecord(payload, 'comment', [...commonFields, 'fileId', 'body', 'authorId', 'resolved']) ?? {}),
      ...patch,
    }
  }
  if (type === 'task_submission_created' || type === 'task.submission.created') {
    return {
      ...pickFields(payload, ['projectId', 'taskId']),
      ...(compactWrappedRecord(payload, 'submission', [...commonFields, 'submittedById']) ?? {}),
    }
  }
  if (type === 'room_created' || type === 'room.created') return compactWrappedRecord(payload, 'room', commonFields) ?? payload
  if (type === 'employee_invited' || type === 'employee.invited') return compactWrappedRecord(payload, 'invite', [...commonFields, 'email', 'role']) ?? payload

  return payload
}

export function emitCompanyRealtime(companyId: string | null | undefined, type: RealtimeEventName, payload: unknown) {
  if (!companyId) return
  const compactPayload = compactRealtimePayload(type, payload)

  void enqueueRealtimeDelivery({
    type,
    target: { scope: 'workspace', workspaceId: companyId },
    workspaceId: companyId,
    payload: compactPayload,
  }).catch((error) => {
    logger.error('realtime.company_enqueue_failed', error, { companyId, type })
    emitRealtimeEnvelopeDirect({
      envelope: buildRealtimeEnvelope({ type, workspaceId: companyId, payload: compactPayload }),
      target: { scope: 'workspace', workspaceId: companyId },
      emitLegacyEvent: true,
      queuedAt: new Date().toISOString(),
    })
  })
}

export function emitUserRealtime(userId: string | null | undefined, type: RealtimeEventName, payload: unknown) {
  if (!userId) return

  void enqueueRealtimeDelivery({
    type,
    target: { scope: 'user', userId },
    payload,
  }).catch((error) => {
    logger.error('realtime.user_enqueue_failed', error, { userId, type })
    emitRealtimeEnvelopeDirect({
      envelope: buildRealtimeEnvelope({ type, workspaceId: null, payload }),
      target: { scope: 'user', userId },
      emitLegacyEvent: true,
      queuedAt: new Date().toISOString(),
    })
  })
}

export function emitPresence(companyId: string | null | undefined, type: 'user_online' | 'user_offline', user: RealtimeUser) {
  emitCompanyRealtime(companyId, type, {
    userId: user.id,
    name: user.name ?? null,
    role: user.role ?? null,
    companyId: companyId ?? null,
    online: type === 'user_online',
    at: new Date().toISOString(),
  })
}
