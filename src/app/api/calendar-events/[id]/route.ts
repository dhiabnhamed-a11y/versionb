import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

type UpdateCalendarEventBody = {
  title?: string
  description?: string | null
  type?: string
  startsAt?: string
  endsAt?: string | null
  color?: string | null
  projectId?: string | null
  taskId?: string | null
}

const EVENT_TYPES = new Set(['PROJECT_EVENT', 'MEETING', 'MILESTONE', 'BLOCKER'])

async function assertEventAccess(id: string, companyId: string) {
  return prisma.calendarEvent.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
}

async function assertProjectAccess(companyId: string, projectId?: string | null) {
  if (!projectId) return true

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  })

  return Boolean(project)
}

async function assertTaskAccess(companyId: string, taskId?: string | null) {
  if (!taskId) return true

  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { companyId } },
    select: { id: true },
  })

  return Boolean(task)
}

export const PATCH = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

const { id } = await ctx.params

try {
const existing = await assertEventAccess(id, user.companyId)
if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

const body = (await req.json()) as UpdateCalendarEventBody
const startsAt = body.startsAt ? new Date(body.startsAt) : undefined
const endsAt = body.endsAt ? new Date(body.endsAt) : body.endsAt === null ? null : undefined

if (startsAt && Number.isNaN(startsAt.getTime())) {
  return NextResponse.json({ error: 'Start date is invalid.' }, { status: 400 })
}

if (startsAt && endsAt instanceof Date && endsAt < startsAt) {
  return NextResponse.json({ error: 'End date must be after the start date.' }, { status: 400 })
}

const [projectAllowed, taskAllowed] = await Promise.all([
  assertProjectAccess(user.companyId, body.projectId),
  assertTaskAccess(user.companyId, body.taskId),
])

if (!projectAllowed || !taskAllowed) {
  return NextResponse.json({ error: 'Linked project or task was not found in this workspace.' }, { status: 404 })
}

const event = await prisma.calendarEvent.update({
  where: { id },
  data: {
    ...(body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
    ...(body.type !== undefined ? { type: EVENT_TYPES.has(body.type) ? body.type : 'PROJECT_EVENT' } : {}),
    ...(startsAt !== undefined ? { startsAt } : {}),
    ...(endsAt !== undefined ? { endsAt } : {}),
    ...(body.color !== undefined ? { color: body.color || null } : {}),
    ...(body.projectId !== undefined ? { projectId: body.projectId || null } : {}),
    ...(body.taskId !== undefined ? { taskId: body.taskId || null } : {}),
  },
  include: {
    project: { select: { id: true, title: true } },
    task: { select: { id: true, title: true, stage: true } },
    createdBy: { select: { id: true, name: true } },
  },
})

return NextResponse.json({ ...event, source: 'calendar', readOnly: false })
} catch (err) {
console.error(err)
return NextResponse.json({ error: 'Server error' }, { status: 500 })
}
}, { auth: 'required' });

export const DELETE = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

const { id } = await ctx.params

try {
const existing = await assertEventAccess(id, user.companyId)
if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

await prisma.calendarEvent.delete({ where: { id } })
return NextResponse.json({ success: true })
} catch (err) {
console.error(err)
return NextResponse.json({ error: 'Server error' }, { status: 500 })
}
}, { auth: 'required' });
