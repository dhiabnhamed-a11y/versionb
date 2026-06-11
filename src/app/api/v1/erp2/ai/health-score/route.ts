import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { computeHealthScore } from '@/services/erp2/ai'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const result = await computeHealthScore(user.companyId!)
  return apiData(result, { code: 'ERP_HEALTH_SCORE_READY' })
},
{
  auth: 'required',
  responseMode: 'canonical',
  route: '/api/v1/erp2/ai/health-score',
}
)
}, { auth: 'required' });
