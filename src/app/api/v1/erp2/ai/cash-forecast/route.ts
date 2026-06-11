import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { computeCashForecast } from '@/services/erp2/ai'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const url = new URL(req.url)
  const days = Math.min(90, parseInt(url.searchParams.get('days') ?? '90', 10) || 90)
  const result = await computeCashForecast(user.companyId!, days)
  return apiData(result, { code: 'ERP_CASH_FORECAST_READY' })
},
{
  auth: 'required',
  responseMode: 'canonical',
  route: '/api/v1/erp2/ai/cash-forecast',
}
)
}, { auth: 'required' });
