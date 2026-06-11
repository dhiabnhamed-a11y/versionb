import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { initializeRecommendedFinanceWorkspace } from '@/modules/finance/setup.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => apiData(await initializeRecommendedFinanceWorkspace(user), { status: 201 }),
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });

