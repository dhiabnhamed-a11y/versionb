import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { getIdempotencyKey, runIdempotent } from '@/lib/idempotency'
import { createTask, listTasks } from '@/modules/tasks/task.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const projectId = req.nextUrl.searchParams.get('projectId')
  return apiData(await listTasks(user, { projectId }), { code: 'TASKS_LISTED' })
},
{ auth: 'required', responseMode: 'canonical' }
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  const task = await runIdempotent(getIdempotencyKey(req), body, () => createTask(user, body), {
    companyId: user.companyId,
    method: req.method,
    responseStatus: 201,
    route: '/api/v1/tasks',
  })
  return apiData(task, { code: 'TASK_CREATED', status: 201 })
},
{ auth: 'required', responseMode: 'canonical' }
)
}, { auth: 'required' });
