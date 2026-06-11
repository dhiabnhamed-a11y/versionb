import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { computeProjectProfitabilitySnapshot } from '@/modules/profitability/profitability.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  return apiData(await computeProjectProfitabilitySnapshot(user, body), { status: 201 })
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
