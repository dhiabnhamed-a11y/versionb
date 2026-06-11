import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createChartOfAccount } from '@/modules/accounting/accounting.service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await createChartOfAccount(user, body), { status: 201 })
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
