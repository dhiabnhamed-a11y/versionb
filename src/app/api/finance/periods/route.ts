import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createFinancialPeriod, listFinancialPeriods } from '@/modules/accounting/accounting.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => apiData(await listFinancialPeriods(user)), { auth: 'required', responseMode: 'legacy' })
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  return apiData(await createFinancialPeriod(user, body), { status: 201 })
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
