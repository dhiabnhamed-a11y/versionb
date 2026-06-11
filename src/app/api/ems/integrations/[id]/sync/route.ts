import type { NextRequest } from 'next/server'
import { handleApiRoute, apiData } from '@/lib/api'
import { prisma } from '@/lib/db'
import { IntegrationRegistry, AuditService } from '@/lib/ems/integration'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, params, async ({ user, params: p }: any) => {
const companyId = user.companyId as string
const id = p.id
const body = await req.json().catch(() => ({}))
const entityType = body.entityType || 'incidents'

const integration = await prisma.emsIntegration.findFirst({ where: { id, companyId } })
if (!integration) throw new Error('Not found')

const registry = IntegrationRegistry.getInstance()
const connector = registry.getConnector(id)
if (!connector) throw new Error('Connector not initialized. Test connection first.')

const result = await connector.sync(entityType, body.params)
const audit = new AuditService(companyId)
await audit.logIntegrationAction({
  integrationId: id,
  action: result.success ? 'EMS_SYNC_COMPLETED' : 'EMS_SYNC_FAILED',
  description: `Sync ${entityType}: ${result.recordsCreated} created, ${result.recordsUpdated} updated, ${result.recordsFailed} failed`,
  resourceType: entityType, success: result.success,
  errorMessage: result.errors.join('; '), metadata: result as any,
})
return apiData(result)
}, { auth: 'required', responseMode: 'legacy', route: '/api/ems/integrations/[id]/sync' })
}, { auth: 'required' });
