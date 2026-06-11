import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { deleteTask, updateTask } from '@/modules/tasks/task.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const PATCH = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
ctx,
async ({ params, user }) => {
  const body = await parseJsonObject(req)
  return apiData(await updateTask(user, params.id, body))
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });

export const DELETE = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
_req,
ctx,
async ({ params, user }) => apiData(await deleteTask(user, params.id)),
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
