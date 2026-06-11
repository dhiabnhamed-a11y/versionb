import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { deleteTask, updateTask } from '@/modules/tasks/task.service'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    undefined,
    async ({ params, user }) => {
      const body = await parseJsonObject(req)
      return apiData(await updateTask(user, params.id, body), { code: 'TASK_UPDATED' })
    },
    { auth: 'required', idempotency: true, responseMode: 'canonical', route: '/api/v1/tasks/{id}' }
  )
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    undefined,
    async ({ params, user }) => apiData(await deleteTask(user, params.id), { code: 'TASK_DELETED' }),
    { auth: 'required', idempotency: true, responseMode: 'canonical', route: '/api/v1/tasks/{id}' }
  )
}
