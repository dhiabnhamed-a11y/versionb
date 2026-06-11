import type { NextRequest } from 'next/server'
import { handleApiRoute, apiData } from '@/lib/api'
import { prisma } from '@/lib/db'
import { AuditService } from '@/lib/ems/integration'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const { searchParams } = new URL(req.url)
    const integrationId = searchParams.get('integrationId')
    const where: Record<string, unknown> = { companyId }
    if (integrationId) where.integrationId = integrationId
    const configs = await prisma.emsWebhookConfig.findMany({
      where: where as any,
      include: { _count: { select: { events: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return apiData(configs)
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/integrations/webhooks' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const body = await req.json()
    const { integrationId, name, path, sourceSystem, sourceType, eventTypes, secretToken, allowedIps, requireAuth, ackMode, maxRetries, deadLetterQueue } = body
    if (!integrationId || !name) throw new Error('integrationId and name are required')

    const integration = await prisma.emsIntegration.findFirst({ where: { id: integrationId, companyId } })
    if (!integration) throw new Error('Integration not found')

    const config = await prisma.emsWebhookConfig.create({
      data: {
        companyId, integrationId, name,
        path: path || null, sourceSystem: sourceSystem || null, sourceType: sourceType || null,
        eventTypes: eventTypes || [], secretToken: secretToken || null,
        allowedIps: allowedIps || null, requireAuth: requireAuth !== false,
        ackMode: ackMode || '200_OK', maxRetries: maxRetries ?? 3,
        deadLetterQueue: deadLetterQueue !== false,
      },
    })

    const audit = new AuditService(companyId)
    await audit.logIntegrationAction({
      integrationId, action: 'EMS_INTEGRATION_CONFIGURED',
      description: `Webhook "${name}" created at path "${path || 'auto'}"`, success: true,
    })
    return apiData(config, { status: 201 })
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/integrations/webhooks',
  })
}
