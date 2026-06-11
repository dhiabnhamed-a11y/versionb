import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { seedStandardAgencyChart } from '@/services/erp'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  return apiData(await seedStandardAgencyChart(user, body), { code: 'ERP_STANDARD_CHART_SEEDED', status: 201 })
},
{
  auth: 'required',
  idempotency: { responseStatus: 201 },
  responseMode: 'canonical',
  route: '/api/v1/erp/setup/standard-chart',
}
)
}, { auth: 'required' });
