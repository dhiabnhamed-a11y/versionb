import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import {
  deleteProjectForUser,
  getProjectForUser,
  updateProjectForUser,
} from '@/modules/projects/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    undefined,
    async ({ params, user }) => apiData(await getProjectForUser(user, params.id), { code: 'PROJECT_RETRIEVED' }),
    { auth: 'required', responseMode: 'canonical', route: '/api/v1/projects/{id}' }
  )
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    undefined,
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
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    undefined,
    async ({ params, user }) => apiData(await deleteProjectForUser(user, params.id), { code: 'PROJECT_DELETED' }),
    {
      auth: 'required',
      idempotency: true,
      rateLimit: { max: 30, namespace: 'projects.write', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/v1/projects/{id}',
    }
  )
}
