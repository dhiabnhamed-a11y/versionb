import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { NO_STORE_HEADERS } from '@/lib/http'
import {
  deleteProjectForUser,
  getProjectForUser,
  updateProjectForUser,
} from '@/modules/projects/service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
ctx,
async ({ params, user }) =>
  apiData(await getProjectForUser(user, params.id), { headers: NO_STORE_HEADERS }),
{ auth: 'required', responseMode: 'legacy', route: '/api/projects/[id]' }
)
}, { auth: 'required' });

export const PATCH = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
ctx,
async ({ params, user }) => {
  const body = await parseJsonObject(req)
  return apiData(await updateProjectForUser(user, params.id, body))
},
{
  auth: 'required',
  idempotency: true,
  rateLimit: { max: 30, namespace: 'projects.write', windowMs: 60_000 },
  responseMode: 'legacy',
  route: '/api/projects/[id]',
}
)
}, { auth: 'required' });

export const DELETE = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
ctx,
async ({ params, user }) => apiData(await deleteProjectForUser(user, params.id)),
{
  auth: 'required',
  idempotency: true,
  rateLimit: { max: 30, namespace: 'projects.write', windowMs: 60_000 },
  responseMode: 'legacy',
  route: '/api/projects/[id]',
}
)
}, { auth: 'required' });
