import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { decideFinanceApprovalStep } from '@/modules/finance/approval.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
context,
async ({ params, user }) => {
  const body = await parseJsonObject(req)
  return apiData(await decideFinanceApprovalStep(user, params.id, body))
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
