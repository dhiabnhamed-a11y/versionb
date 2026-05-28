import type { NextRequest } from 'next/server'
import { handleApiRoute, apiData } from '@/lib/api'
import { prisma } from '@/lib/db'
import { IntegrationRegistry, AuditService } from '@/lib/ems/integration'
import type { EmsIntegrationType } from '@/lib/ems/integration'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const registry = IntegrationRegistry.getInstance()
    const statusData = await registry.getIntegrationStatus(companyId)
    return apiData(statusData)
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/integrations' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const body = await req.json()
    const { name, type, endpointUrl, authType, apiKey, webhookSecret, config } = body

    if (!name || !type) throw new Error('name and type are required')

    const integration = await prisma.emsIntegration.create({
      data: {
        companyId, name, type: type as EmsIntegrationType,
        status: 'PENDING', endpointUrl: endpointUrl || null,
        authType: authType || 'none', apiKey: apiKey || null,
        webhookSecret: webhookSecret || null, config: config || {},
      },
    })

    const registry = IntegrationRegistry.getInstance()
    await registry.createConnector(integration.id, companyId, type as EmsIntegrationType, {
      endpointUrl, authType, apiKey, webhookSecret, ...(config || {}),
    })

    const connector = registry.getConnector(integration.id)
    if (connector) {
      const connected = await connector.connect()
      if (connected) {
        await prisma.emsIntegration.update({
          where: { id: integration.id },
          data: { status: 'CONNECTED', lastConnectedAt: new Date() },
        })
      }
    }

    const audit = new AuditService(companyId)
    await audit.logIntegrationAction({
      integrationId: integration.id, action: 'EMS_INTEGRATION_CONFIGURED',
      description: `Integration ${name} (${type}) created`, success: true,
    })

    return apiData(integration, { status: 201 })
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/integrations',
  })
}

export async function PUT(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const body = await req.json()
    const { id, name, endpointUrl, authType, apiKey, webhookSecret, isEnabled, config } = body
    if (!id) throw new Error('id is required')

    const existing = await prisma.emsIntegration.findFirst({ where: { id, companyId } })
    if (!existing) throw new Error('Integration not found')

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (endpointUrl !== undefined) updateData.endpointUrl = endpointUrl
    if (authType !== undefined) updateData.authType = authType
    if (apiKey !== undefined) updateData.apiKey = apiKey
    if (webhookSecret !== undefined) updateData.webhookSecret = webhookSecret
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled
    if (config !== undefined) updateData.config = config

    const updated = await prisma.emsIntegration.update({ where: { id }, data: updateData })

    if (endpointUrl !== undefined || authType !== undefined || apiKey !== undefined || config !== undefined) {
      const registry = IntegrationRegistry.getInstance()
      await registry.createConnector(id, companyId, existing.type as EmsIntegrationType, {
        endpointUrl: endpointUrl || existing.endpointUrl || undefined,
        authType: authType || existing.authType as any || 'none',
        apiKey: apiKey || existing.apiKey || undefined,
        webhookSecret: webhookSecret || existing.webhookSecret || undefined,
        ...((config || existing.config) as Record<string, unknown>),
      })
      const connector = registry.getConnector(id)
      if (connector && isEnabled !== false) await connector.connect()
    }

    if (isEnabled === false) {
      const registry = IntegrationRegistry.getInstance()
      await registry.removeConnector(id)
    }

    return apiData(updated)
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/integrations',
  })
}

export async function DELETE(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) throw new Error('id is required')

    const existing = await prisma.emsIntegration.findFirst({ where: { id, companyId } })
    if (!existing) throw new Error('Integration not found')

    const registry = IntegrationRegistry.getInstance()
    await registry.removeConnector(id)
    await prisma.emsIntegration.delete({ where: { id } })

    const audit = new AuditService(companyId)
    await audit.logIntegrationAction({
      integrationId: id, action: 'EMS_INTEGRATION_CONFIGURED',
      description: `Integration ${existing.name} deleted`, success: true,
    })

    return apiData({ deleted: true })
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/integrations',
  })
}
