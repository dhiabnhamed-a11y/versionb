import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { API_RATE_LIMITS } from '@/lib/api-defaults'
import { cached } from '@/lib/cache'
import { getEnterpriseOperationsDashboard } from '@/modules/enterprise/enterprise.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) =>
  apiData(
    await cached(`enterprise-ops:${user.companyId ?? 'none'}`, 45, () => getEnterpriseOperationsDashboard(user))
  ),
{ auth: 'required', responseMode: 'canonical', rateLimit: API_RATE_LIMITS.read }
)
}, { auth: 'required' });
