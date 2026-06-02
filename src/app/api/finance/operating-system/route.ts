import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { getFinancialOperatingSystemDashboard } from '@/modules/reporting'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => apiData(await getFinancialOperatingSystemDashboard(user)), {
    auth: 'required',
    responseMode: 'legacy',
  })
}
