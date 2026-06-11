import type { NextRequest } from 'next/server'
import { apiData as _apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { FleetService } from '@/modules/ems/fleet.service'

export const runtime = 'nodejs'

function apiData(data: any, opts?: any) {
  return _apiData(data, opts)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRoute(req, { params }, async ({ params: p, user }: any) => {
    const companyId = user.companyId || ''
    const body = await parseJsonObject(req)
    if (body.status) return apiData(await FleetService.updateUnitStatus(companyId, p.id, body.status))
    return apiData({ message: 'No update provided' })
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/units/[id]',
  })
}
