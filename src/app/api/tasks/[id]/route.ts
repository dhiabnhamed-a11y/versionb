import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { deleteTask, updateTask } from '@/modules/tasks/task.service'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    ctx,
    async ({ params, user }) => apiData(await deleteTask(user, params.id)),
    { auth: 'required', responseMode: 'legacy' }
  )
}
