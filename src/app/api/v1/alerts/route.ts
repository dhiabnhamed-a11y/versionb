import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { getIdempotencyKey, runIdempotent } from '@/lib/idempotency'
import { createUserAlert, listCurrentUserAlerts, markCurrentUserAlertRead } from '@/modules/alerts/service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => apiData(await listCurrentUserAlerts(user), { code: 'ALERTS_LISTED' }),
{ auth: 'required', responseMode: 'canonical' }
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
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
}, { auth: 'required' });

export const PATCH = withApiHandler(async ({ req, params }) => {
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
}, { auth: 'required' });
