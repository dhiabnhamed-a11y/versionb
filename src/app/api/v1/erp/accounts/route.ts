import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createErpAccount, listErpChartAccounts } from '@/services/erp'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => apiData(await listErpChartAccounts(user), { code: 'ERP_ACCOUNTS_LISTED' }),
{ auth: 'required', responseMode: 'canonical', route: '/api/v1/erp/accounts' }
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  return apiData(await createErpAccount(user, body), { code: 'ERP_ACCOUNT_CREATED', status: 201 })
},
{
  auth: 'required',
  idempotency: { responseStatus: 201 },
  responseMode: 'canonical',
  route: '/api/v1/erp/accounts',
}
)
}, { auth: 'required' });
