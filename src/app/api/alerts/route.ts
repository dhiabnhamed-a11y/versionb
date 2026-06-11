import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createUserAlert, listCurrentUserAlerts, markCurrentUserAlertRead } from '@/modules/alerts/service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

// GET alerts for the current user
export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => apiData(await listCurrentUserAlerts(user)),
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });

// POST send an alert to an employee
export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  return apiData(await createUserAlert(user, body), { status: 201 })
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });

// PATCH mark alert as read
export const PATCH = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  return apiData(await markCurrentUserAlertRead(user, body))
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
