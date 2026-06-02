import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiData, handleApiRoute, validateJson, type ApiParams } from '@/lib/api'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

const EVENT_TYPES = ['PROJECT_EVENT', 'MEETING', 'MILESTONE', 'BLOCKER'] as const
const EVENT_TYPES_SET = new Set<string>(EVENT_TYPES)

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(EVENT_TYPES).optional().default('PROJECT_EVENT'),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
})

function getDateRange(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const fallbackFrom = new Date()
  fallbackFrom.setDate(1)
  fallbackFrom.setHours(0, 0, 0, 0)

  const fallbackTo = new Date(fallbackFrom)
  fallbackTo.setMonth(fallbackTo.getMonth() + 1)
  fallbackTo.setDate(7)

  return {
    from: from ? new Date(from) : fallbackFrom,
    to: to ? new Date(to) : fallbackTo,
  }
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

export async function GET(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      if (!user.companyId) return apiData([])

      const { from, to } = getDateRange(req)

      const [events, taskDeadlines] = await Promise.all([
        prisma.calendarEvent.findMany({
          where: {
            companyId: user.companyId,
            startsAt: { gte: from, lte: to },
          },
          include: {
            project: { select: { id: true, title: true } },
            task: { select: { id: true, title: true, stage: true } },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { startsAt: 'asc' },
        }),
        prisma.task.findMany({
          where: {
            project: { companyId: user.companyId },
            deadline: { gte: from, lte: to },
          },
          select: {
            id: true,
            title: true,
            priority: true,
            stage: true,
            deadline: true,
            project: { select: { id: true, title: true } },
            assignee: { select: { id: true, name: true } },
          },
          orderBy: { deadline: 'asc' },
        }),
      ])

      return apiData([
        ...events.map((event) => ({ ...event, source: 'calendar', readOnly: false })),
        ...taskDeadlines.map((task) => ({
          id: `task-${task.id}`,
          taskId: task.id,
          projectId: task.project.id,
          title: task.title,
          description: task.assignee ? `Assigned to ${task.assignee.name}` : null,
          type: 'TASK_DEADLINE',
          startsAt: task.deadline,
          endsAt: null,
          color: task.stage === 'DONE' ? '#059669' : task.priority === 'CRITICAL' ? '#dc2626' : '#d97706',
          project: task.project,
          task: { id: task.id, title: task.title, stage: task.stage },
          createdBy: null,
          source: 'task',
          readOnly: true,
        })),
      ])
    },
    {
      auth: 'required',
      rateLimit: { max: 30, namespace: 'calendar-events.list', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/calendar-events',
    }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      if (!user.companyId) {
        return apiData({ error: 'No company found for this account' }, { status: 400 }) as never
      }
      if (user.role === 'EMPLOYEE') {
        return apiData({ error: 'Forbidden' }, { status: 403 }) as never
      }

      const parsed = await validateJson(req, createEventSchema)
      const title = parsed.title.trim()
      const startsAt = new Date(parsed.startsAt)
      const endsAt = parsed.endsAt ? new Date(parsed.endsAt) : null
      const type = EVENT_TYPES_SET.has(parsed.type) ? parsed.type : 'PROJECT_EVENT'

      if (Number.isNaN(startsAt.getTime())) {
        return apiData({ error: 'Title and start date are required.' }, { status: 400 }) as never
      }
      if (endsAt && endsAt < startsAt) {
        return apiData({ error: 'End date must be after the start date.' }, { status: 400 }) as never
      }

      const [projectAllowed, taskAllowed] = await Promise.all([
        assertProjectAccess(user.companyId, parsed.projectId),
        assertTaskAccess(user.companyId, parsed.taskId),
      ])
      if (!projectAllowed || !taskAllowed) {
        return apiData({ error: 'Linked project or task was not found in this workspace.' }, { status: 404 }) as never
      }

      const event = await prisma.calendarEvent.create({
        data: {
          title,
          description: parsed.description?.trim() || null,
          type,
          startsAt,
          endsAt,
          color: parsed.color || null,
          companyId: user.companyId,
          projectId: parsed.projectId || null,
          taskId: parsed.taskId || null,
          createdById: user.id,
        },
        include: {
          project: { select: { id: true, title: true } },
          task: { select: { id: true, title: true, stage: true } },
          createdBy: { select: { id: true, name: true } },
        },
      })

      return apiData({ ...event, source: 'calendar', readOnly: false }, { status: 201 })
    },
    {
      auth: 'required',
      idempotency: { responseStatus: 201 },
      rateLimit: { max: 20, namespace: 'calendar-events.create', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/calendar-events',
    }
  )
}
