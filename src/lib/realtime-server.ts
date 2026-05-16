import type { RealtimeEventName } from './realtime-events'
import { enqueueRealtimeDelivery, emitRealtimeEnvelopeDirect } from '@/modules/realtime/events/delivery'
import { buildRealtimeEnvelope } from '@/modules/realtime/events/contracts'
import type { PresenceUser } from '@/modules/realtime/presence/presence-store'
import { logger } from '@/modules/shared/logger'

export type RealtimeUser = PresenceUser

export function emitCompanyRealtime(companyId: string | null | undefined, type: RealtimeEventName, payload: unknown) {
  if (!companyId) return

  void enqueueRealtimeDelivery({
    type,
    target: { scope: 'workspace', workspaceId: companyId },
    workspaceId: companyId,
    payload,
  }).catch((error) => {
    logger.error('realtime.company_enqueue_failed', error, { companyId, type })
    emitRealtimeEnvelopeDirect({
      envelope: buildRealtimeEnvelope({ type, workspaceId: companyId, payload }),
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
