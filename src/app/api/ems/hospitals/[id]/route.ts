import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRoute(req, { params }, async ({ params: p, user }) => {
    const companyId = user.companyId || ''
    const body = await parseJsonObject(req)
    const updated = await EmsService.updateHospitalStatus(companyId, p.id, body.status || body.status, body)
    return apiData(updated)
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/hospitals/[id]',
  })
}
