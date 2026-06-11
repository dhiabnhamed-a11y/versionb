import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { generateContractForClient, listClientContracts } from '@/modules/contracts/contract.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
context,
async ({ params, user }) => apiData({ items: await listClientContracts(user, params.id) }),
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
context,
async ({ params, requestId, user }) => {
  const body = await parseJsonObject(req)
  return apiData(await generateContractForClient(user, { ...body, clientId: params.id }, requestId), { status: 201 })
},
{
  auth: 'required',
  responseMode: 'legacy',
  rateLimit: {
    namespace: 'contracts.generate',
    windowMs: 60_000,
    max: 8,
  },
}
)
}, { auth: 'required' });
