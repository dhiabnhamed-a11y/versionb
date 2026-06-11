import type { NextRequest } from 'next/server'
import { handleApiRoute, apiData } from '@/lib/api'
import { prisma } from '@/lib/db'
import { FieldMappingService, AuditService } from '@/lib/ems/integration'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const { searchParams } = new URL(req.url)
    const integrationId = searchParams.get('integrationId')
    const entityType = searchParams.get('entityType')

    const where: Record<string, unknown> = { companyId }
    if (integrationId) where.integrationId = integrationId
    if (entityType) where.entityType = entityType

    const mappings = await prisma.emsFieldMapping.findMany({ where: where as any, orderBy: { createdAt: 'desc' } })
    return apiData(mappings)
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/integrations/mappings' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const body = await req.json()
    const { integrationId, name, entityType, mappings, enumMappings, validationRules } = body
    if (!integrationId || !name || !entityType || !mappings) throw new Error('integrationId, name, entityType, and mappings are required')

    const integration = await prisma.emsIntegration.findFirst({ where: { id: integrationId, companyId } })
    if (!integration) throw new Error('Integration not found')

    const mappingService = new FieldMappingService(companyId, integrationId)
    const result = await mappingService.createMapping({ name, entityType, mappings, enumMappings, validationRules })

    const audit = new AuditService(companyId)
    await audit.logIntegrationAction({
      integrationId, action: 'EMS_FIELD_MAPPING_CREATED',
      description: `Field mapping "${name}" created for ${entityType}`,
      resourceType: entityType, success: true,
    })
    return apiData(result, { status: 201 })
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/integrations/mappings',
  })
}

export async function PUT(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const body = await req.json()
    const { id, name, mappings, enumMappings, validationRules, isActive } = body
    if (!id) throw new Error('id is required')

    const existing = await prisma.emsFieldMapping.findFirst({ where: { id, companyId } })
    if (!existing) throw new Error('Not found')

    const mappingService = new FieldMappingService(companyId, existing.integrationId)
    const result = await mappingService.updateMapping(id, { name, mappings, enumMappings, validationRules, isActive })

    const audit = new AuditService(companyId)
    await audit.logIntegrationAction({
      integrationId: existing.integrationId, action: 'EMS_FIELD_MAPPING_UPDATED',
      description: `Field mapping "${name || existing.name}" updated`,
      resourceType: existing.entityType, success: true,
    })
    return apiData(result)
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/integrations/mappings',
  })
}

export async function DELETE(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId as string
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) throw new Error('id is required')

    const existing = await prisma.emsFieldMapping.findFirst({ where: { id, companyId } })
    if (!existing) throw new Error('Not found')

    await prisma.emsFieldMapping.delete({ where: { id } })
    const mappingService = new FieldMappingService(companyId, existing.integrationId)
    mappingService.invalidateCache(existing.entityType)

    const audit = new AuditService(companyId)
    await audit.logIntegrationAction({
      integrationId: existing.integrationId, action: 'EMS_FIELD_MAPPING_DELETED',
      description: `Field mapping "${existing.name}" deleted`,
      resourceType: existing.entityType, success: true,
    })
    return apiData({ deleted: true })
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/integrations/mappings' })
}
