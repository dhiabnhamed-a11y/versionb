import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const companyId = user.companyId || ''
      const body = await parseJsonObject(req)
      const updated = await EmsService.updateUnitPosition(
        companyId,
        body.unitId,
        body.lat,
        body.lng,
        { heading: body.heading, speed: body.speed, accuracy: body.accuracy, batteryLevel: body.batteryLevel }
      )
      return apiData(updated)
    },
    {
      auth: 'required',
      requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
      rateLimit: { max: 60, namespace: 'ems.position', windowMs: 60_000 },
      responseMode: 'legacy',
      route: '/api/ems/position',
    }
  )
}
