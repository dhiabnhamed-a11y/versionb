import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject, type ApiRouteContext } from '@/lib/api'
import { lockErpFinancialPeriod } from '@/services/erp'

type Params = { id: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, context: ApiRouteContext<Params>) {
  return handleApiRoute(
    req,
    context,
    async ({ user, params }) => {
      const body = await parseJsonObject(req)
      return apiData(await lockErpFinancialPeriod(user, params.id, body), { code: 'ERP_PERIOD_LOCKED' })
    },
    {
      auth: 'required',
      idempotency: true,
      responseMode: 'canonical',
      route: '/api/v1/erp/periods/[id]/lock',
    }
  )
}
