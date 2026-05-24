import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { computeHealthScore } from '@/services/erp2/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const result = await computeHealthScore(user.companyId!)
      return apiData(result, { code: 'ERP_HEALTH_SCORE_READY' })
    },
    {
      auth: 'required',
      responseMode: 'canonical',
      route: '/api/v1/erp2/ai/health-score',
    }
  )
}
