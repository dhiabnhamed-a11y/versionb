import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    const crews = await prisma.emsCrew.findMany({
      where: { companyId },
      include: {
        members: {
          include: { unit: { select: { unitNumber: true } } },
        },
      },
      orderBy: { name: 'asc' },
    })
    return apiData(crews)
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/crews' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    const body = await parseJsonObject(req)
    const crew = await prisma.emsCrew.create({
      data: { companyId, name: body.name, code: body.code, type: body.type || 'ALS' },
    })
    return apiData(crew, { status: 201 })
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/crews',
  })
}
