import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject, type ApiRouteContext } from '@/lib/api'
import { lockErpFinancialPeriod } from '@/services/erp'
import { withApiHandler } from "@/lib/api/handler";

type Params = { id: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
context,
async ({ user, params }) => {
  const body = await parseJsonObject(req)
  return apiData(await lockErpFinancialPeriod(user, params.id, body), { code: 'ERP_PERIOD_LOCKED' })
},
{
  auth: 'required',
  idempotency: true,
  responseMode: 'canonical',
  route: '/api/v1/erp/periods/[id]/lock',
}
)
}, { auth: 'required' });
