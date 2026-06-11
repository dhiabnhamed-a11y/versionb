import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { getErpTrialBalance } from '@/services/erp'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) =>
  apiData(
    await getErpTrialBalance(user, {
      startsAt: req.nextUrl.searchParams.get('startsAt'),
      endsAt: req.nextUrl.searchParams.get('endsAt'),
      departmentId: req.nextUrl.searchParams.get('departmentId'),
      projectId: req.nextUrl.searchParams.get('projectId'),
      costCenterId: req.nextUrl.searchParams.get('costCenterId'),
      currency: req.nextUrl.searchParams.get('currency'),
    }),
    { code: 'ERP_TRIAL_BALANCE_GENERATED' }
  ),
{ auth: 'required', responseMode: 'canonical', route: '/api/v1/erp/trial-balance' }
)
}, { auth: 'required' });
