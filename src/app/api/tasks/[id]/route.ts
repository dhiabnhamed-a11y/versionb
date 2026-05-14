import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { deleteTask, updateTask } from '@/modules/tasks/task.service'

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  return handleApiRoute(
    req,
    ctx,
    async ({ params, user }) => {
      const body = await parseJsonObject(req)
      return apiData(await updateTask(user, params.id, body))
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  return handleApiRoute(
    _req,
    ctx,
    async ({ params, user }) => apiData(await deleteTask(user, params.id)),
    { auth: 'required', responseMode: 'legacy' }
  )
}
