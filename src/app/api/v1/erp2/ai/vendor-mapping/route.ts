import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { learnVendorMapping, listVendorMappings } from '@/services/erp2/ai'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const mappings = await listVendorMappings(user.companyId!)
  return apiData(mappings, { code: 'ERP_VENDOR_MAPPINGS_LISTED' })
},
{
  auth: 'required',
  responseMode: 'canonical',
  route: '/api/v1/erp2/ai/vendor-mapping',
}
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  const result = await learnVendorMapping(
    user.companyId!,
    body.vendorName,
    body.accountCode,
  )
  return apiData(result, { code: 'ERP_VENDOR_MAPPING_LEARNED', status: 201 })
},
{
  auth: 'required',
  responseMode: 'canonical',
  route: '/api/v1/erp2/ai/vendor-mapping',
}
)
}, { auth: 'required' });
