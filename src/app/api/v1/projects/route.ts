import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import {
  createProjectForUser,
  listProjectsForUser,
} from '@/modules/projects/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => apiData(await listProjectsForUser(user), { code: 'PROJECTS_LISTED' }),
    { auth: 'required', responseMode: 'canonical', route: '/api/v1/projects' }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      const project = await createProjectForUser(user, body)
      return apiData(project, { code: 'PROJECT_CREATED', status: 201 })
    },
    {
      auth: 'required',
      idempotency: { responseStatus: 201 },
      rateLimit: { max: 30, namespace: 'projects.write', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/v1/projects',
    }
  )
}
