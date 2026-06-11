import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createTask, listTasks } from '@/modules/tasks/task.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const projectId = req.nextUrl.searchParams.get('projectId')
  return apiData(await listTasks(user, { projectId }))
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  return apiData(await createTask(user, body), { status: 201 })
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
