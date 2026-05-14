import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createTask, listTasks } from '@/modules/tasks/task.service'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const projectId = req.nextUrl.searchParams.get('projectId')
      return apiData(await listTasks(user, { projectId }), { code: 'TASKS_LISTED' })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await createTask(user, body), { code: 'TASK_CREATED', status: 201 })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
