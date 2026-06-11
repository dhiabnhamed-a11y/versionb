import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { prisma } from '@/lib/db'
import { EmsService } from '@/modules/ems/ems.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const companyId = user.companyId || ''
await EmsService.getOrCreateEmsCompany(companyId)
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
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const companyId = user.companyId || ''
await EmsService.getOrCreateEmsCompany(companyId)
const body = await parseJsonObject(req)
const crew = await prisma.emsCrew.create({
  data: { companyId, name: body.name, code: body.code, type: body.type || 'ALS' },
})
return apiData(crew, { status: 201 })
}, {
auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
responseMode: 'legacy', route: '/api/ems/crews',
})
}, { auth: 'required' });
