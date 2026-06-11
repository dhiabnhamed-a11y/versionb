import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { generateEnterpriseForecast } from '@/modules/forecasting'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => apiData(await generateEnterpriseForecast(user)), {
auth: 'required',
responseMode: 'legacy',
})
}, { auth: 'required' });
