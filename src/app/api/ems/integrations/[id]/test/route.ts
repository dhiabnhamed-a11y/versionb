import type { NextRequest } from 'next/server'
import { handleApiRoute, apiData } from '@/lib/api'
import { prisma } from '@/lib/db'
import { IntegrationRegistry } from '@/lib/ems/integration'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, params, async ({ user, params: p }: any) => {
const companyId = user.companyId as string
const id = p.id
const integration = await prisma.emsIntegration.findFirst({ where: { id, companyId } })
if (!integration) throw new Error('Not found')

const registry = IntegrationRegistry.getInstance()
let connector = registry.getConnector(id)
if (!connector) {
  connector = await registry.createConnector(id, companyId, integration.type as any, {
    endpointUrl: integration.endpointUrl || undefined,
    authType: integration.authType as any,
    apiKey: integration.apiKey || undefined,
    webhookSecret: integration.webhookSecret || undefined,
    ...((integration.config || {}) as Record<string, unknown>),
  })
}

const result = await connector.testConnection()
await prisma.emsIntegration.update({
  where: { id },
  data: {
    status: result.success ? 'CONNECTED' : 'ERROR',
    lastConnectedAt: result.success ? new Date() : undefined,
    lastErrorAt: result.success ? undefined : new Date(),
    lastErrorMessage: result.success ? null : result.message,
  },
})
return apiData(result)
}, { auth: 'required', responseMode: 'legacy', route: '/api/ems/integrations/[id]/test' })
}, { auth: 'required' });
