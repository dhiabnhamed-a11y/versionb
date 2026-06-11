import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { getFinancialOperatingSystemDashboard } from '@/modules/reporting'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => apiData(await getFinancialOperatingSystemDashboard(user)), {
auth: 'required',
responseMode: 'legacy',
})
}, { auth: 'required' });
