import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { listAlerts, getAlertCounts, runAnomalyDetection } from '@/services/erp2/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const url = new URL(req.url)
      const unresolvedOnly = url.searchParams.get('unresolved') === 'true'
      const counts = await getAlertCounts(user.companyId!)
      const alerts = await listAlerts(user.companyId!, unresolvedOnly)
      return apiData({ alerts, counts }, { code: 'ERP_ALERTS_LISTED' })
    },
    {
      auth: 'required',
      responseMode: 'canonical',
      route: '/api/v1/erp2/ai/anomalies',
    }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const count = await runAnomalyDetection(user.companyId!)
      return apiData({ alertsCreated: count }, { code: 'ERP_ANOMALY_SCAN_COMPLETE' })
    },
    {
      auth: 'required',
      responseMode: 'canonical',
      route: '/api/v1/erp2/ai/anomalies',
    }
  )
}
