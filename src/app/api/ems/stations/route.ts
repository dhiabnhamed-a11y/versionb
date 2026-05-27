// @ts-nocheck — depends on prisma generate for Ems* models
import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    const stations = await prisma.emsStation.findMany({
      where: { companyId },
      include: { _count: { select: { units: true } } },
      orderBy: { name: 'asc' },
    })
    return apiData(stations)
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/stations' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    const body = await parseJsonObject(req)
    const station = await prisma.emsStation.create({
      data: { companyId, name: body.name, code: body.code, lat: body.lat, lng: body.lng, address: body.address, phone: body.phone },
    })
    return apiData(station, { status: 201 })
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/stations',
  })
}
