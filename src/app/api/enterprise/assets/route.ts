import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createAsset, listAssets } from '@/modules/enterprise/enterprise.service'
import { parseEnterpriseListOptions } from '@/modules/enterprise/enterprise.repository'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const url = new URL(req.url)
const { pagination, filters } = parseEnterpriseListOptions(url.searchParams)
const result = await listAssets(user, { ...filters, skip: pagination.skip, take: pagination.pageSize })
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
  return apiData(await createAsset(user, body, requestId), { status: 201 })
},
{ auth: 'required', responseMode: 'canonical' }
)
}, { auth: 'required' });
