import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { updateMaintenanceWorkOrder } from '@/modules/enterprise/enterprise.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MaintenanceRouteContext = { params: Promise<{ id: string }> | { id: string } }

export async function PATCH(req: NextRequest, context: MaintenanceRouteContext) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user, requestId }) => {
      const body = await parseJsonObject(req)
      return apiData(await updateMaintenanceWorkOrder(user, String(params.id), body, requestId))
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
