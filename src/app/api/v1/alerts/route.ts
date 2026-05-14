import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
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
      return apiData(await createUserAlert(user, body), { code: 'ALERT_CREATED', status: 201 })
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
      return apiData(await markCurrentUserAlertRead(user, body), { code: 'ALERT_MARKED_READ' })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
