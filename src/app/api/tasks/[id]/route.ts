import { NextRequest } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { okJson, parseJsonObject, withApiError } from '@/modules/shared/api'
import { deleteTask, updateTask } from '@/modules/tasks/task.service'

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const { id } = await ctx.params
    const body = await parseJsonObject(req)
    const task = await updateTask(user, id, body)
    return okJson(task)
  })
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const { id } = await ctx.params
    const result = await deleteTask(user, id)
    return okJson(result)
  })
}
