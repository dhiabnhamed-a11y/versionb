import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { getAlertCounts } from '@/services/erp2/ai'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const counts = await getAlertCounts(user.companyId!)
  return apiData(counts, { code: 'ERP_ALERT_COUNTS' })
},
{
  auth: 'required',
  responseMode: 'canonical',
  route: '/api/v1/erp2/alerts',
}
)
}, { auth: 'required' });
