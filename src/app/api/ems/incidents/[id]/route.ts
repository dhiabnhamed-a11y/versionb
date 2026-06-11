import type { NextRequest } from 'next/server'
import { apiData as _apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

function apiData(data: any, opts?: any) {
  return _apiData(data, opts)
}

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
{ params },
async ({ params: p, user }: any) => {
  const companyId = user.companyId || ''
  const incident = await EmsService.getIncident(companyId, p.id)
  return apiData(incident)
},
{ auth: 'required', responseMode: 'legacy', route: '/api/ems/incidents/[id]' }
)
}, { auth: 'required' });

export const PATCH = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
{ params },
async ({ params: p, user }: any) => {
  const companyId = user.companyId || ''
  const body = await parseJsonObject(req)
  if (body.status) {
    const updated = await EmsService.updateIncidentStatus(companyId, p.id, body.status, { ...body, actorId: user.id })
    return apiData(updated)
  }
  return apiData({ message: 'No status provided' })
},
{
  auth: 'required',
  requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
  responseMode: 'legacy',
  route: '/api/ems/incidents/[id]',
}
)
}, { auth: 'required' });
