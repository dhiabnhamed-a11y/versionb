import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createUserAlert, listCurrentUserAlerts, markCurrentUserAlertRead } from '@/modules/alerts/service'

export const runtime = 'nodejs'

// GET alerts for the current user
export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => apiData(await listCurrentUserAlerts(user)),
    { auth: 'required', responseMode: 'legacy' }
  )
}

// POST send an alert to an employee
export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await createUserAlert(user, body), { status: 201 })
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}

// PATCH mark alert as read
export async function PATCH(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await markCurrentUserAlertRead(user, body))
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
