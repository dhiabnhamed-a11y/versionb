import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { getEnterpriseOperationsDashboard } from '@/modules/enterprise/enterprise.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => apiData(await getEnterpriseOperationsDashboard(user)),
    { auth: 'required', responseMode: 'canonical' }
  )
}
