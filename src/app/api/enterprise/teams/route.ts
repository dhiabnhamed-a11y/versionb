import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { listEnterpriseTeams } from '@/modules/enterprise/enterprise.repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      if (!user.companyId) return apiData([])
      const teams = await listEnterpriseTeams(user.companyId)
      return apiData(teams)
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
