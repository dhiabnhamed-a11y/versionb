import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { generateEnterpriseForecast } from '@/modules/forecasting'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => apiData(await generateEnterpriseForecast(user)), {
    auth: 'required',
    responseMode: 'legacy',
  })
}
