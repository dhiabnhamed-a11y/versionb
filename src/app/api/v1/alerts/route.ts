import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { getIdempotencyKey, runIdempotent } from '@/lib/idempotency'
import { createUserAlert, listCurrentUserAlerts, markCurrentUserAlertRead } from '@/modules/alerts/service'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => apiData(await listCurrentUserAlerts(user), { code: 'ALERTS_LISTED' }),
    { auth: 'required', responseMode: 'canonical' }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      const alert = await runIdempotent(getIdempotencyKey(req), body, () => createUserAlert(user, body), {
        companyId: user.companyId,
        method: req.method,
        responseStatus: 201,
        route: '/api/v1/alerts',
      })
      return apiData(alert, { code: 'ALERT_CREATED', status: 201 })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}

export async function PATCH(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      const alert = await runIdempotent(getIdempotencyKey(req), body, () => markCurrentUserAlertRead(user, body), {
        companyId: user.companyId,
        method: req.method,
        route: '/api/v1/alerts',
      })
      return apiData(alert, { code: 'ALERT_MARKED_READ' })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
