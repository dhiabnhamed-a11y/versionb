import type { NextRequest } from 'next/server'
import { handleApiRoute, apiData } from '@/lib/api'
import { prisma } from '@/lib/db'
import { AuditService } from '@/lib/ems/integration'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return (handleApiRoute as any)(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'audit'

    if (type === 'events') {
      const integrationId = searchParams.get('integrationId')
      const status = searchParams.get('status')
      const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
      const offset = Number(searchParams.get('offset')) || 0
      const where: Record<string, unknown> = { companyId }
      if (integrationId) where.integrationId = integrationId
      if (status) where.status = status
      const [events, total] = await Promise.all([
        prisma.emsIntegrationEvent.findMany({ where: where as any, orderBy: { receivedAt: 'desc' }, take: limit, skip: offset }),
        prisma.emsIntegrationEvent.count({ where: where as any }),
      ])
      return apiData({ events, total, limit, offset })
    }

    const action = searchParams.get('action') || undefined
    const resourceType = searchParams.get('resourceType') || undefined
    const containsPhi = searchParams.get('containsPhi')
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
    const auditService = new AuditService(companyId)
    const logs = await auditService.getAuditLog({
      action, resourceType,
      containsPhi: containsPhi === 'true' ? true : containsPhi === 'false' ? false : undefined,
      limit,
    })
    return apiData({ logs, limit })
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/integrations/logs' })
}
