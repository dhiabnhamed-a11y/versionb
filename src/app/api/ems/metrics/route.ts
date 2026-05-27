import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const companyId = user.companyId || ''
      const metrics = await EmsService.getDashboardMetrics(companyId)
      return apiData(metrics)
    },
    { auth: 'required', responseMode: 'legacy', route: '/api/ems/metrics' }
  )
}
