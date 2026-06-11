import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { setupErpWorkspace } from '@/services/erp2'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  const result = await setupErpWorkspace(user.companyId!, body.baseCurrency)
  return apiData(result, { code: 'ERP_SETUP_COMPLETE', status: 201 })
},
{
  auth: 'required',
  idempotency: { responseStatus: 201 },
  responseMode: 'canonical',
  route: '/api/v1/erp2/setup',
}
)
}, { auth: 'required' });
