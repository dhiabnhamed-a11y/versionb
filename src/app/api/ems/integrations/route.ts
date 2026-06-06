import type { NextRequest } from 'next/server'
import { badRequest, handleApiRoute, apiData } from '@/lib/api'
import { prisma } from '@/lib/db'
import { IntegrationRegistry, AuditService } from '@/lib/ems/integration'
import type { EmsIntegrationType } from '@/lib/ems/integration'
import { logger } from '@/modules/shared/logger'

export const runtime = 'nodejs'

const EMS_INTEGRATION_TYPES: readonly EmsIntegrationType[] = [
  'CAD_MOTOROLA',
  'CAD_HEXAGON',
  'CAD_TYLER',
  'CAD_CENTRAL_SQUARE',
  'CAD_ZOLL',
  'CAD_RAPID_SOS',
  'CAD_CUSTOM',
  'EHR_EPIC',
  'EHR_CERNER',
  'EHR_ALLSCRIPTS',
  'EHR_MEDITECH',
  'EHR_CUSTOM',
  'FHIR',
  'HL7',
  'AVL_GPS',
  'CUSTOM_API',
  'CUSTOM_WEBHOOK',
]

function isEmsIntegrationType(value: unknown): value is EmsIntegrationType {
  return typeof value === 'string' && EMS_INTEGRATION_TYPES.includes(value as EmsIntegrationType)
}

function normalizeOptionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function ensureEmsCompany(companyId: string) {
  await prisma.emsCompany.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  })
}

async function getSerializedIntegration(integrationId: string) {
  const registry = IntegrationRegistry.getInstance()
  const integration = await prisma.emsIntegration.findUnique({
    where: { id: integrationId },
    include: {
      fieldMappings: { orderBy: { createdAt: 'desc' } },
      webhookConfigs: { orderBy: { createdAt: 'desc' } },
      _count: { select: { integrationEvents: true, auditLogs: true } },
    },
  })
  if (!integration) return null
  const health = await registry.getHealth(integration.id)
  return { ...integration, health }
}

async function listSerializedIntegrations(companyId: string) {
  const registry = IntegrationRegistry.getInstance()
  const integrations = await prisma.emsIntegration.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: {
      fieldMappings: { orderBy: { createdAt: 'desc' } },
      webhookConfigs: { orderBy: { createdAt: 'desc' } },
      _count: { select: { integrationEvents: true, auditLogs: true } },
    },
  })

  return Promise.all(
    integrations.map(async (integration) => ({
      ...integration,
      health: await registry.getHealth(integration.id),
    }))
  )
}

function summarizeIntegrations(integrations: Array<{ status: string }>) {
  const counts = { total: integrations.length, connected: 0, error: 0, disconnected: 0, pending: 0 }
  for (const integration of integrations) {
    if (integration.status === 'CONNECTED') counts.connected++
    else if (integration.status === 'ERROR') counts.error++
    else if (integration.status === 'DISCONNECTED') counts.disconnected++
    else counts.pending++
  }
  return { ...counts, integrations }
}

async function logIntegrationAction(companyId: string, input: Parameters<AuditService['logIntegrationAction']>[0]) {
  try {
    await new AuditService(companyId).logIntegrationAction(input)
  } catch (error) {
    logger.warn('ems.integration_audit_failed', {
      action: input.action,
      companyId,
      error: error instanceof Error ? error.message : String(error),
      integrationId: input.integrationId,
    })
  }
}

async function configureConnector(input: {
  companyId: string
  integrationId: string
  type: EmsIntegrationType
  endpointUrl: string | null
  authType: string | null
  apiKey: string | null
  webhookSecret: string | null
  config: Record<string, unknown>
}) {
  try {
    const registry = IntegrationRegistry.getInstance()
    await registry.createConnector(input.integrationId, input.companyId, input.type, {
      endpointUrl: input.endpointUrl || undefined,
      authType: (input.authType as any) || 'none',
      apiKey: input.apiKey || undefined,
      webhookSecret: input.webhookSecret || undefined,
      ...input.config,
    })

    const connector = registry.getConnector(input.integrationId)
    if (!connector) return

    const connected = await connector.connect()
    if (connected) {
      await prisma.emsIntegration.update({
        where: { id: input.integrationId },
        data: { status: 'CONNECTED', lastConnectedAt: new Date(), lastErrorAt: null, lastErrorMessage: null },
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connector setup failed'
    logger.warn('ems.integration_connector_failed', {
      companyId: input.companyId,
      error: message,
      integrationId: input.integrationId,
      type: input.type,
    })
    await prisma.emsIntegration.update({
      where: { id: input.integrationId },
      data: { status: 'ERROR', lastErrorAt: new Date(), lastErrorMessage: message, errorCount: { increment: 1 } },
    })
  }
}

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const integrations = await listSerializedIntegrations(companyId)
    return apiData(summarizeIntegrations(integrations))
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/integrations' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const body = await req.json()
    const { name, type, endpointUrl, authType, apiKey, webhookSecret, config } = body

    if (typeof name !== 'string' || !name.trim()) throw badRequest('name is required')
    if (!isEmsIntegrationType(type)) throw badRequest('Select a valid EMS integration type.')

    await ensureEmsCompany(companyId)

    const existing = await prisma.emsIntegration.findFirst({ where: { companyId, type } })
    const data = {
      name: name.trim(),
      type,
      status: 'PENDING' as const,
      endpointUrl: normalizeOptionalText(endpointUrl),
      authType: normalizeOptionalText(authType) || 'none',
      apiKey: normalizeOptionalText(apiKey),
      webhookSecret: normalizeOptionalText(webhookSecret),
      config: config && typeof config === 'object' ? config : {},
      lastErrorAt: null,
      lastErrorMessage: null,
    }

    const integration = existing
      ? await prisma.emsIntegration.update({ where: { id: existing.id }, data })
      : await prisma.emsIntegration.create({ data: { companyId, ...data } })

    await configureConnector({
      companyId,
      integrationId: integration.id,
      type,
      endpointUrl: data.endpointUrl,
      authType: data.authType,
      apiKey: data.apiKey,
      webhookSecret: data.webhookSecret,
      config: data.config as Record<string, unknown>,
    })

    await logIntegrationAction(companyId, {
      integrationId: integration.id,
      action: 'EMS_INTEGRATION_CONFIGURED',
      description: `Integration ${name} (${type}) created`, success: true,
    })

    return apiData(await getSerializedIntegration(integration.id), { status: existing ? 200 : 201 })
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
