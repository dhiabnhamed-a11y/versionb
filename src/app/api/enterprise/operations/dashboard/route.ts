import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { API_RATE_LIMITS } from '@/lib/api-defaults'
import { cached } from '@/lib/cache'
import { getEnterpriseOperationsDashboard } from '@/modules/enterprise/enterprise.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) =>
      apiData(
        await cached(`enterprise-ops:${user.companyId ?? 'none'}`, 45, () => getEnterpriseOperationsDashboard(user))
      ),
    { auth: 'required', responseMode: 'canonical', rateLimit: API_RATE_LIMITS.read }
  )
}
