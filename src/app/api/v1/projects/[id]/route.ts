import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
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
async ({ params, user }) => apiData(await getProjectForUser(user, params.id), { code: 'PROJECT_RETRIEVED' }),
{ auth: 'required', responseMode: 'canonical', route: '/api/v1/projects/{id}' }
)
}, { auth: 'required' });

export const PATCH = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
ctx,
async ({ params, user }) => {
  const body = await parseJsonObject(req)
  return apiData(await updateProjectForUser(user, params.id, body), { code: 'PROJECT_UPDATED' })
},
{
  auth: 'required',
  idempotency: true,
  rateLimit: { max: 30, namespace: 'projects.write', windowMs: 60_000 },
  responseMode: 'canonical',
  route: '/api/v1/projects/{id}',
}
)
}, { auth: 'required' });

export const DELETE = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
ctx,
async ({ params, user }) => apiData(await deleteProjectForUser(user, params.id), { code: 'PROJECT_DELETED' }),
{
  auth: 'required',
  idempotency: true,
  rateLimit: { max: 30, namespace: 'projects.write', windowMs: 60_000 },
  responseMode: 'canonical',
  route: '/api/v1/projects/{id}',
}
)
}, { auth: 'required' });
