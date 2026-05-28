import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { prisma } from '@/lib/db'
import { EmsService } from '@/modules/ems/ems.service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    await EmsService.getOrCreateEmsCompany(companyId)
    const protocols = await prisma.emsProtocol.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })
    return apiData(protocols)
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/protocols' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    await EmsService.getOrCreateEmsCompany(companyId)
    const body = await parseJsonObject(req)
    const protocol = await prisma.emsProtocol.create({
      data: { companyId, name: body.name, code: body.code, type: body.type, content: body.content, severity: body.severity },
    })
    return apiData(protocol, { status: 201 })
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/protocols',
  })
}
