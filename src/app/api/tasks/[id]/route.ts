import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteTasksById } from '@/lib/delete-graph'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { getStageProgress } from '@/lib/utils'
import {
  assertDeliverableInCompany,
  assertTaskDependenciesSatisfied,
  createDeliverableForTask,
  replaceTaskDependencies,
} from '@/lib/creative-workflow'

type SessionUser = {
  id: string
  role: string
  companyId?: string | null
}

type UpdateTaskBody = {
  stage?: string
  title?: string
  description?: string | null
  priority?: string
  deliverableType?: string
  deliverableId?: string
  dependencyIds?: string[]
  deadline?: string | null
  assigneeId?: string | null
  projectId?: string
  reviewComment?: string
}

const EMPLOYEE_ALLOWED_STAGE_TRANSITIONS: Record<string, string[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['REVIEW'],
  REVIEW: [],
  DONE: [],
}

// PATCH update a task (stage, progress, etc.)
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const user = session.user as SessionUser

  try {
    const body = (await req.json()) as UpdateTaskBody
    const { stage, title, description, priority, deliverableType, deliverableId, dependencyIds, deadline, assigneeId, projectId, reviewComment } = body

    const existing = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        assigneeId: true,
        stage: true,
        deliverableId: true,
        projectId: true,
        project: { select: { companyId: true } },
        deliverable: { select: { id: true, approvalState: true, campaignId: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.companyId && existing.project.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (user.role === 'EMPLOYEE' && existing.assigneeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Employees can only update stage
    const updateData: Prisma.TaskUncheckedUpdateInput = {}
    if (stage) {
      if (user.role === 'EMPLOYEE') {
        const allowedStages = EMPLOYEE_ALLOWED_STAGE_TRANSITIONS[existing.stage] ?? []
        if (!allowedStages.includes(stage)) {
          return NextResponse.json({ error: 'Employees can only move tasks into progress or send them to review.' }, { status: 403 })
        }
      }

      updateData.stage = stage
      updateData.progress = getStageProgress(stage)

      if (stage === 'IN_PROGRESS') {
        const dependencyStatus = await assertTaskDependenciesSatisfied(id)
        if (!dependencyStatus.ok) {
          return NextResponse.json({ error: dependencyStatus.message }, { status: 409 })
        }
      }
    }
    if (user.role !== 'EMPLOYEE') {
      if (title) updateData.title = title
      if (description !== undefined) updateData.description = description
      if (priority) updateData.priority = priority
      if (deliverableType) updateData.deliverableType = deliverableType.trim().toUpperCase()
      if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null
      if (assigneeId !== undefined) {
        if (assigneeId) {
          const assignee = await prisma.user.findFirst({
            where: { id: assigneeId, companyId: existing.project.companyId },
            select: { id: true },
          })
          if (!assignee) return NextResponse.json({ error: 'Selected assignee was not found in this workspace.' }, { status: 404 })
        }
        updateData.assigneeId = assigneeId || null
      }
      if (deliverableId !== undefined && deliverableId !== existing.deliverableId) {
        const deliverable = await assertDeliverableInCompany(deliverableId, existing.project.companyId)
        if (!deliverable) return NextResponse.json({ error: 'Selected deliverable was not found in this workspace.' }, { status: 404 })
        updateData.deliverableId = deliverable.id
        updateData.projectId = deliverable.campaignId
      } else if (projectId !== undefined && projectId !== existing.projectId) {
        const deliverable = await createDeliverableForTask({
          companyId: existing.project.companyId,
          campaignId: projectId,
          title: title?.trim() || existing.title,
          description: description === undefined ? existing.description : description,
          type: deliverableType,
          dueAt: deadline ? new Date(deadline) : null,
          createdById: user.id,
        })
        if (!deliverable) return NextResponse.json({ error: 'Selected campaign was not found in this workspace.' }, { status: 404 })
        updateData.deliverableId = deliverable.id
        updateData.projectId = deliverable.campaignId
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: updateData,
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

      if (Array.isArray(dependencyIds)) {
        await replaceTaskDependencies(tx, id, dependencyIds)
      }

      if (stage === 'REVIEW') {
        await tx.deliverable.update({
          where: { id: task.deliverableId },
          data: { status: 'INTERNAL_REVIEW', approvalState: 'PENDING' },
        })
      }
      if (user.role !== 'EMPLOYEE' && stage === 'DONE') {
        await tx.deliverable.update({
          where: { id: task.deliverableId },
          data: {
            status: 'APPROVED',
            approvalState: 'APPROVED',
            revisionCount: { increment: 1 },
          },
        })
        await tx.approvalDecision.create({
          data: {
            companyId: existing.project.companyId,
            deliverableId: task.deliverableId,
            decidedById: user.id,
            status: 'APPROVED',
            note: reviewComment?.trim() || null,
          },
        })
      }
      if (user.role !== 'EMPLOYEE' && stage === 'IN_PROGRESS' && reviewComment?.trim()) {
        await tx.deliverable.update({
          where: { id: task.deliverableId },
          data: { status: 'INTERNAL_REVIEW', approvalState: 'CHANGES_REQUESTED' },
        })
      }

      return task
    })

    // Log activity
    const trimmedReviewComment = reviewComment?.trim()
    const action =
      user.role !== 'EMPLOYEE' && stage === 'DONE'
        ? 'Review accepted'
        : user.role !== 'EMPLOYEE' && stage === 'IN_PROGRESS' && trimmedReviewComment
          ? `Review rejected: ${trimmedReviewComment}`
          : stage
            ? `Stage moved to ${stage}`
            : 'Task updated'
    await prisma.activity.create({
      data: { taskId: id, userId: user.id, action },
    })

    emitCompanyRealtime(existing.project.companyId, 'task_updated', { projectId: updated.project.id, task: updated, action })

    return NextResponse.json(updated)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE a task
export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await ctx.params

  try {
    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true, projectId: true, project: { select: { companyId: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.companyId && existing.project.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.$transaction((tx) => deleteTasksById(tx, [id]))
    emitCompanyRealtime(existing.project.companyId, 'task_deleted', { projectId: existing.projectId, taskId: id })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
