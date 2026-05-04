import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { getProjectMediaSupport } from '@/lib/project-media-support'

type SessionUser = {
  id: string
  role: string
  companyId?: string | null
}

type CreateTaskBody = {
  title: string
  description?: string
  priority?: string
  deliverableType?: string
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
    return NextResponse.json([], { headers: NO_STORE_HEADERS })
  }
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  try {
    const mediaSupport = await getProjectMediaSupport()
    const tasks = await prisma.task.findMany({
      where: {
        ...(user.role === 'EMPLOYEE' ? { assigneeId: user.id } : {}),
        ...(projectId ? { projectId } : {}),
        project: { companyId: user.companyId },
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatar: true } },
        project: {
          select: {
            id: true,
            title: true,
            room: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        submissions: {
          select: {
            id: true,
            fileUrl: true,
            fileName: true,
            fileType: true,
            ...(mediaSupport.hasTaskSubmissionCloudinaryColumns
              ? {
                  mediaType: true,
                  fileSize: true,
                  duration: true,
                  thumbnailUrl: true,
                  playbackUrl: true,
                  cloudinaryPublicId: true,
                }
              : {}),
            note: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: user.role === 'EMPLOYEE' ? 6 : 3,
        },
        activities: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(tasks, { headers: NO_STORE_HEADERS })
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
    const { title, description, priority, deliverableType, deadline, assigneeId, projectId } = (await req.json()) as CreateTaskBody

    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
      select: { id: true },
    })
    if (!project) return NextResponse.json({ error: 'Selected project was not found in this workspace.' }, { status: 404 })

    if (assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assigneeId, companyId: user.companyId },
        select: { id: true },
      })
      if (!assignee) return NextResponse.json({ error: 'Selected assignee was not found in this workspace.' }, { status: 404 })
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        deliverableType: deliverableType?.trim().toUpperCase() || 'GENERAL',
        deadline: deadline ? new Date(deadline) : null,
        assigneeId,
        projectId,
        stage: 'TODO',
        progress: 0,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: {
          select: {
            id: true,
            title: true,
            room: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
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

    emitCompanyRealtime(user.companyId, 'task_created', { projectId: task.project.id, task })

    return NextResponse.json(task, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
