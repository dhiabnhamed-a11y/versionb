import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    const hospitals = await EmsService.getHospitalsWithCapacity(companyId)
    return apiData(hospitals)
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/hospitals' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    await EmsService.getOrCreateEmsCompany(companyId)
    const body = await parseJsonObject(req)
    const hospital = await prisma.emsHospital.create({
      data: {
        companyId,
        name: body.name,
        code: body.code,
        lat: body.lat,
        lng: body.lng,
        address: body.address,
        phone: body.phone,
        edPhone: body.edPhone,
        bedCount: body.bedCount || 0,
        availableBeds: body.availableBeds || 0,
        icuBeds: body.icuBeds || 0,
        availableIcu: body.availableIcu || 0,
        traumaLevel: body.traumaLevel,
        capabilities: body.capabilities || [],
        status: body.status || 'OPEN',
      },
    })
    return apiData(hospital, { status: 201 })
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/hospitals',
  })
}
