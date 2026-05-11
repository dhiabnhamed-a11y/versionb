import { NextRequest, NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { okJson, parseJsonObject, withApiError } from '@/modules/shared/api'
import { createTask, listTasks } from '@/modules/tasks/task.service'

export async function GET(req: NextRequest) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const projectId = req.nextUrl.searchParams.get('projectId')
    const tasks = await listTasks(user, { projectId })
    return okJson(tasks)
  })
}

export async function POST(req: NextRequest) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const body = await parseJsonObject(req)
    const task = await createTask(user, body)
    return NextResponse.json(task, { status: 201 })
  })
}
