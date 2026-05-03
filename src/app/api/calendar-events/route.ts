import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type SessionUser = {
  id: string
  role: string
  companyId?: string | null
}

type CreateCalendarEventBody = {
  title: string
  description?: string
  type?: string
  startsAt: string
  endsAt?: string | null
  color?: string | null
  projectId?: string | null
  taskId?: string | null
}

const EVENT_TYPES = new Set(['PROJECT_EVENT', 'MEETING', 'MILESTONE', 'BLOCKER'])

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
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json([])

  const { from, to } = getDateRange(req)

  try {
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

    return NextResponse.json([
      ...events.map((event) => ({
        ...event,
        source: 'calendar',
        readOnly: false,
      })),
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
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = (await req.json()) as CreateCalendarEventBody
    const title = body.title?.trim()
    const startsAt = body.startsAt ? new Date(body.startsAt) : null
    const endsAt = body.endsAt ? new Date(body.endsAt) : null
    const type = EVENT_TYPES.has(body.type ?? '') ? body.type : 'PROJECT_EVENT'

    if (!title || !startsAt || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: 'Title and start date are required.' }, { status: 400 })
    }

    if (endsAt && endsAt < startsAt) {
      return NextResponse.json({ error: 'End date must be after the start date.' }, { status: 400 })
    }

    const [projectAllowed, taskAllowed] = await Promise.all([
      assertProjectAccess(user.companyId, body.projectId),
      assertTaskAccess(user.companyId, body.taskId),
    ])

    if (!projectAllowed || !taskAllowed) {
      return NextResponse.json({ error: 'Linked project or task was not found in this workspace.' }, { status: 404 })
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description: body.description?.trim() || null,
        type,
        startsAt,
        endsAt,
        color: body.color || null,
        companyId: user.companyId,
        projectId: body.projectId || null,
        taskId: body.taskId || null,
        createdById: user.id,
      },
      include: {
        project: { select: { id: true, title: true } },
        task: { select: { id: true, title: true, stage: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ ...event, source: 'calendar', readOnly: false }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
