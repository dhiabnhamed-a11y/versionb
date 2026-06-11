import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const companyId = user.companyId || ''
      const overview = await EmsService.getFleetOverview(companyId)
      return apiData(overview)
    },
    { auth: 'required', responseMode: 'legacy', route: '/api/ems/fleet' }
  )
}
