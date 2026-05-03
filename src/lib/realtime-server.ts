import type { RealtimeEventName, RealtimeWorkspaceEvent } from './realtime-events'

type RealtimeUser = {
  id: string
  name?: string | null
  role?: string | null
  companyId?: string | null
}

function getIO() {
  return global.io
}

function workspaceEvent(type: RealtimeEventName, payload: unknown): RealtimeWorkspaceEvent {
  return {
    type,
    payload,
    at: new Date().toISOString(),
  }
}

export function emitCompanyRealtime(companyId: string | null | undefined, type: RealtimeEventName, payload: unknown) {
  if (!companyId) return

  const io = getIO()
  if (!io) return

  const event = workspaceEvent(type, payload)
  io.to(`company:${companyId}`).emit(type, payload)
  io.to(`company:${companyId}`).emit('workspace_event', event)
}

export function emitUserRealtime(userId: string | null | undefined, type: RealtimeEventName, payload: unknown) {
  if (!userId) return

  const io = getIO()
  if (!io) return

  io.to(`user:${userId}`).emit(type, payload)
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
