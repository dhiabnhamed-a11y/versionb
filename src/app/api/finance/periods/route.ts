import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createFinancialPeriod, listFinancialPeriods } from '@/modules/accounting/accounting.service'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => apiData(await listFinancialPeriods(user)), { auth: 'required', responseMode: 'legacy' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await createFinancialPeriod(user, body), { status: 201 })
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
