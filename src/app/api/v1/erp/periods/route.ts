import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createErpFinancialPeriod, listErpFinancialPeriods } from '@/services/erp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => apiData(await listErpFinancialPeriods(user), { code: 'ERP_PERIODS_LISTED' }),
    { auth: 'required', responseMode: 'canonical', route: '/api/v1/erp/periods' }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await createErpFinancialPeriod(user, body), { code: 'ERP_PERIOD_CREATED', status: 201 })
    },
    {
      auth: 'required',
      idempotency: { responseStatus: 201 },
      responseMode: 'canonical',
      route: '/api/v1/erp/periods',
    }
  )
}
