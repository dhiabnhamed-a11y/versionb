import { NextRequest } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { okJson, withApiError } from '@/modules/shared/api'
import { analyticsQuerySchema } from '@/modules/integrations/services/integration.validation'
import { getSocialAnalyticsDashboard } from '@/modules/integrations/services/analytics.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return withApiError(async () => {
const user = await requireSessionUser()
const input = analyticsQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()))
const dashboard = await getSocialAnalyticsDashboard(user, input)
return okJson(dashboard)
})
}, { auth: 'required' });
