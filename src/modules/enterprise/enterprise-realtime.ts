import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { getExecutiveDashboard, getDepartmentDashboard, getTeamDashboard } from '@/modules/enterprise/enterprise-dashboards'
import { logger } from '@/modules/shared/logger'
import type { SessionUser } from '@/modules/shared/session'

let socketEmitter: any = null

async function getEmitter() {
  if (!socketEmitter) {
    try {
      const { Emitter } = await import('@socket.io/redis-emitter')
      const { createClient } = await import('redis')
      const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' })
      await client.connect()
      socketEmitter = new Emitter(client)
    } catch (err) {
      logger.warn('enterprise.realtime_unavailable', { error: String(err) })
      return null
    }
  }
  return socketEmitter
}

export async function pushDashboardUpdate(
  companyId: string,
  dashboardType: 'executive' | 'department' | 'team',
  data: Record<string, unknown>
) {
  const emitter = await getEmitter()
  if (!emitter) return { pushed: false, reason: 'realtime_unavailable' }

  emitter.to(`workspace:${companyId}`).emit('enterprise:dashboard:update', {
    type: dashboardType,
    data,
    timestamp: new Date().toISOString(),
  })

  return { pushed: true }
}

export async function pushIncidentUpdate(
  companyId: string,
  event: string,
  payload: Record<string, unknown>
) {
  const emitter = await getEmitter()
  if (!emitter) return { pushed: false, reason: 'realtime_unavailable' }

  emitter.to(`workspace:${companyId}`).emit(`enterprise:incident:${event}`, {
    ...payload,
    timestamp: new Date().toISOString(),
  })

  return { pushed: true }
}

export async function broadcastDashboardToWorkspace(user: SessionUser, dashboardType: 'executive' | 'department' | 'team', scopeId?: string) {
  const cid = user.companyId
  if (!cid) return { pushed: false, reason: 'no_company' }

  let data: Record<string, unknown>

  switch (dashboardType) {
    case 'executive':
      data = await getExecutiveDashboard(user) as any
      break
    case 'department':
      data = scopeId ? (await getDepartmentDashboard(user, scopeId)) as any : {}
      break
    case 'team':
      data = scopeId ? (await getTeamDashboard(user, scopeId)) as any : {}
      break
    default:
      return { pushed: false, reason: 'unknown_type' }
  }

  return pushDashboardUpdate(cid, dashboardType, data)
}
