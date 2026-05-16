import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { updateIncident } from '@/modules/enterprise/enterprise.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type IncidentRouteContext = { params: Promise<{ id: string }> | { id: string } }

export async function PATCH(req: NextRequest, context: IncidentRouteContext) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user, requestId }) => {
      const body = await parseJsonObject(req)
      return apiData(await updateIncident(user, String(params.id), body, requestId))
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
