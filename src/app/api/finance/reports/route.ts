import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { generateFinancialReport } from '@/modules/reporting'
import { financialReportQuerySchema } from '@/modules/reporting/reporting.validation'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const query = financialReportQuerySchema.parse({
    kind: req.nextUrl.searchParams.get('kind') ?? 'profit-and-loss',
    startsAt: req.nextUrl.searchParams.get('startsAt') ?? undefined,
    endsAt: req.nextUrl.searchParams.get('endsAt') ?? undefined,
    currency: req.nextUrl.searchParams.get('currency') ?? undefined,
  })
  return apiData(await generateFinancialReport(user, query))
},
{
  auth: 'required',
  responseMode: 'legacy',
}
)
}, { auth: 'required' });
