import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createTreasuryAccount, listTreasuryAccounts } from '@/modules/treasury/treasury.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => apiData(await listTreasuryAccounts(user)), {
auth: 'required',
responseMode: 'legacy',
})
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  return apiData(await createTreasuryAccount(user, body), { status: 201 })
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
