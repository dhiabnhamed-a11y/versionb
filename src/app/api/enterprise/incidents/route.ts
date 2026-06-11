import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createIncident, listIncidents } from '@/modules/enterprise/enterprise.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const url = new URL(req.url)
const result = await listIncidents(user, url.searchParams)
return apiData(result.data, { pagination: result.pagination })
}, {
auth: 'required',
responseMode: 'canonical',
})
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user, requestId }) => {
  const body = await parseJsonObject(req)
  return apiData(await createIncident(user, body, requestId), { status: 201 })
},
{ auth: 'required', responseMode: 'canonical' }
)
}, { auth: 'required' });
