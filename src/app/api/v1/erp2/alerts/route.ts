import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { getAlertCounts } from '@/services/erp2/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const counts = await getAlertCounts(user.companyId!)
      return apiData(counts, { code: 'ERP_ALERT_COUNTS' })
    },
    {
      auth: 'required',
      responseMode: 'canonical',
      route: '/api/v1/erp2/alerts',
    }
  )
}
