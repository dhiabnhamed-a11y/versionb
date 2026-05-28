import type { NextRequest } from 'next/server'
import { apiData as _apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { FleetService } from '@/modules/ems/fleet.service'
import { EmsService } from '@/modules/ems/ems.service'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

function apiData(data: any, opts?: any) {
  return _apiData(data, opts)
}

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId || ''
    await EmsService.getOrCreateEmsCompany(companyId)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (id) {
      const unit = await prisma.emsUnit.findFirst({
        where: { id, companyId },
        include: { station: true, crewMembers: { include: { crew: true } }, supplies: true },
      })
      return apiData(unit)
    }
    const units = await prisma.emsUnit.findMany({
      where: { companyId },
      include: { station: true, crewMembers: { include: { crew: true } } },
      orderBy: { unitNumber: 'asc' },
    })
    return apiData(units)
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/units' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    await EmsService.getOrCreateEmsCompany(companyId)
    const body = await parseJsonObject(req)
    const unit = await FleetService.registerUnit(companyId, body)
    return apiData(unit, { status: 201 })
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/units',
  })
}
