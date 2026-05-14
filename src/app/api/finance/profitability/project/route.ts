import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { computeProjectProfitabilitySnapshot } from '@/modules/profitability/profitability.service'

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await computeProjectProfitabilitySnapshot(user, body), { status: 201 })
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
