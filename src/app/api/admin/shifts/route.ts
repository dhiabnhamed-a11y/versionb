import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { healthcareService } from '@/modules/healthcare/healthcare.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const companyId = user.companyId || ''
  const rows = await healthcareService.listShifts(companyId)
  return apiData(rows)
},
{ auth: 'required', responseMode: 'legacy', route: '/api/admin/shifts' }
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  const companyId = user.companyId || ''
  const created = await healthcareService.createShift(companyId, body)
  return apiData(created, { status: 201 })
},
{
  auth: 'required',
  requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
  idempotency: { enabled: true, responseStatus: 201 },
  rateLimit: { max: 30, namespace: 'shifts.write', windowMs: 60_000 },
  responseMode: 'legacy',
  route: '/api/admin/shifts',
}
)
}, { auth: 'required' });
