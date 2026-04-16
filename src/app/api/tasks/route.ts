import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type SessionUser = {
  id: string
  role: string
  companyId?: string | null
}

type CreateTaskBody = {
  title: string
  description?: string
  priority?: string
  deadline?: string
  assigneeId?: string
  projectId: string
}

// GET all tasks for user's company
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) {
    return NextResponse.json([])
  }
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  try {
    const tasks = await prisma.task.findMany({
      where: {
        ...(user.role === 'EMPLOYEE' ? { assigneeId: user.id } : {}),
        ...(projectId ? { projectId } : {}),
        project: { companyId: user.companyId },
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatar: true } },
        project: { select: { id: true, title: true } },
        activities: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(tasks)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST create a task
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) {
    return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  }
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { title, description, priority, deadline, assigneeId, projectId } = (await req.json()) as CreateTaskBody

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        deadline: deadline ? new Date(deadline) : null,
        assigneeId,
        projectId,
        stage: 'TODO',
        progress: 0,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, title: true } },
      },
    })

    // Log activity
    await prisma.activity.create({
      data: {
        taskId: task.id,
        userId: user.id,
        action: 'Task created',
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
