import type { NextRequest } from 'next/server'
import { handleApiRoute, apiData } from '@/lib/api'
import { prisma } from '@/lib/db'
import { IntegrationRegistry, AuditService } from '@/lib/ems/integration'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: any) {
  return handleApiRoute(req, params, async ({ user, params: p }: any) => {
    const companyId = user.companyId as string
    const integration = await prisma.emsIntegration.findFirst({
      where: { id: p.id, companyId },
      include: {
        fieldMappings: { orderBy: { createdAt: 'desc' } },
        webhookConfigs: true,
        _count: { select: { integrationEvents: true, auditLogs: true } },
      },
    })
    if (!integration) throw new Error('Not found')
    const registry = IntegrationRegistry.getInstance()
    const health = await registry.getHealth(p.id)
    return apiData({ ...integration, health })
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/integrations/[id]' })
}

export async function PATCH(req: NextRequest, { params }: any) {
  return handleApiRoute(req, params, async ({ user, params: p }: any) => {
    const companyId = user.companyId as string
    const id = p.id
    const body = await req.json()

    const existing = await prisma.emsIntegration.findFirst({ where: { id, companyId } })
    if (!existing) throw new Error('Not found')

    const updateData: Record<string, unknown> = {}
    const allowedFields = ['name', 'endpointUrl', 'authType', 'apiKey', 'webhookSecret', 'isEnabled', 'pollingEnabled', 'pollingInterval', 'retryCount', 'retryDelayMs', 'rateLimit', 'timeoutMs', 'config', 'metadata']
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    if (body.isEnabled === false) {
      updateData.status = 'DISCONNECTED'
      const registry = IntegrationRegistry.getInstance()
      await registry.removeConnector(id)
    }

    const updated = await prisma.emsIntegration.update({ where: { id }, data: updateData })

    if (body.isEnabled === true) {
      const registry = IntegrationRegistry.getInstance()
      await registry.createConnector(id, companyId, existing.type as any, {
        endpointUrl: updated.endpointUrl || undefined,
        authType: updated.authType as any || 'none',
        apiKey: updated.apiKey || undefined,
        webhookSecret: updated.webhookSecret || undefined,
        ...((updated.config || {}) as Record<string, unknown>),
      })
      const connector = registry.getConnector(id)
      if (connector) await connector.connect()
    }

    const audit = new AuditService(companyId)
    await audit.logIntegrationAction({
      integrationId: id,
      action: body.isEnabled === false ? 'EMS_INTEGRATION_DISABLED' : body.isEnabled === true ? 'EMS_INTEGRATION_ENABLED' : 'EMS_INTEGRATION_CONFIGURED',
      description: `Integration ${existing.name} updated`, success: true,
    })

    return apiData(updated)
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/integrations/[id]',
  })
}
