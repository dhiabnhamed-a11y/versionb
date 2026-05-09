import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { getProjectMediaSupport } from '@/lib/project-media-support'
import {
  assertDeliverableInCompany,
  createDeliverableForTask,
  replaceTaskDependencies,
} from '@/lib/creative-workflow'

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
  deliverableId?: string
  dependencyIds?: string[]
  deadline?: string
  assigneeId?: string
  projectId?: string
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
        deliverable: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            approvalState: true,
            revisionCount: true,
            brief: { select: { id: true, title: true, status: true } },
          },
        },
        dependencies: {
          select: {
            dependsOnTask: { select: { id: true, title: true, stage: true } },
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
    const {
      title,
      description,
      priority,
      deliverableType,
      deliverableId,
      dependencyIds = [],
      deadline,
      assigneeId,
      projectId,
    } = (await req.json()) as CreateTaskBody

    if (!title?.trim()) return NextResponse.json({ error: 'Task title is required.' }, { status: 400 })

    let deliverable = deliverableId ? await assertDeliverableInCompany(deliverableId, user.companyId) : null
    if (!deliverable && projectId) {
      deliverable = await createDeliverableForTask({
        companyId: user.companyId,
        campaignId: projectId,
        title: title.trim(),
        description,
        type: deliverableType,
        dueAt: deadline ? new Date(deadline) : null,
        createdById: user.id,
      })
    }
    if (!deliverable) {
      return NextResponse.json(
        { error: 'A task must belong to a deliverable. Send deliverableId, or send projectId during the migration window.' },
        { status: 400 }
      )
    }

    if (assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assigneeId, companyId: user.companyId },
        select: { id: true },
      })
      if (!assignee) return NextResponse.json({ error: 'Selected assignee was not found in this workspace.' }, { status: 404 })
    }

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title: title.trim(),
          description,
          priority: priority || 'MEDIUM',
          deliverableType: deliverableType?.trim().toUpperCase() || 'GENERAL',
          deliverableId: deliverable.id,
          deadline: deadline ? new Date(deadline) : null,
          assigneeId,
          projectId: deliverable.campaignId,
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
          deliverable: {
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              approvalState: true,
              revisionCount: true,
              brief: { select: { id: true, title: true, status: true } },
            },
          },
        },
      })

      await replaceTaskDependencies(tx, created.id, dependencyIds)

      await tx.activity.create({
        data: {
          taskId: created.id,
          userId: user.id,
          action: 'Task created',
        },
      })

      return created
    })

    emitCompanyRealtime(user.companyId, 'task_created', { projectId: task.project.id, task })

    return NextResponse.json(task, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
