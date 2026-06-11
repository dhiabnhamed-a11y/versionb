import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { listEnterpriseTeams } from '@/modules/enterprise/enterprise.repository'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  if (!user.companyId) return apiData([])
  const teams = await listEnterpriseTeams(user.companyId)
  return apiData(teams)
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
