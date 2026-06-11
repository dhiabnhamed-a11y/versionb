import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const companyId = user.companyId || ''
  const overview = await EmsService.getFleetOverview(companyId)
  return apiData(overview)
},
{ auth: 'required', responseMode: 'legacy', route: '/api/ems/fleet' }
)
}, { auth: 'required' });
