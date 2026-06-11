import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { resolveAlert, markAlertRead } from '@/services/erp2/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    ctx,
    async ({ params }) => {
      const url = new URL(req.url)
      const action = url.searchParams.get('action')

      if (action === 'resolve') {
        return apiData(await resolveAlert(params.id), { code: 'ERP_ALERT_RESOLVED' })
      }
      if (action === 'read') {
        return apiData(await markAlertRead(params.id), { code: 'ERP_ALERT_MARKED_READ' })
      }

      return apiData(null, { code: 'ERP_INVALID_ACTION' })
    },
    {
      auth: 'required',
      responseMode: 'canonical',
      route: '/api/v1/erp2/alerts/{id}',
    }
  )
}
