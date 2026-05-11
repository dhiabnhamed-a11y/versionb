import { Prisma } from '@prisma/client'
import { getProjectMediaSupport } from '@/lib/project-media-support'
import { deleteTasksById } from '@/lib/delete-graph'
import { getStageProgress } from '@/lib/utils'
import {
  assertDeliverableInCompany,
  assertTaskDependenciesSatisfied,
  createDeliverableForTask,
  replaceTaskDependencies,
} from '@/lib/creative-workflow'
import { normalizeUserRole } from '@/lib/security'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { registerEnterpriseEventListeners } from '@/modules/events/listeners'
import { assertCan, canManageWorkspace } from '@/modules/permissions/permissions'
import { badRequest, conflict, forbidden, notFound } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'
import { createTaskSchema, updateTaskSchema, type CreateTaskInput, type UpdateTaskInput } from '@/modules/tasks/task.validation'
import {
  createTaskInTransaction,
  findAssignableUser,
  findTaskAccessRecord,
  listTasksForCompany,
  taskRepositoryPrisma as prisma,
  updateTaskInTransaction,
} from '@/modules/tasks/task.repository'

registerEnterpriseEventListeners()

const EMPLOYEE_ALLOWED_STAGE_TRANSITIONS: Record<string, string[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['REVIEW'],
  REVIEW: [],
  DONE: [],
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest('Invalid date value.')
  return date
}

function requireCompany(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found for this account')
  return user.companyId
}

function employeeScopedId(user: SessionUser) {
  return normalizeUserRole(user.role) === 'EMPLOYEE' ? user.id : null
}

export async function listTasks(user: SessionUser, input: { projectId?: string | null }) {
  if (!user.companyId) return []

  const mediaSupport = await getProjectMediaSupport()
  return listTasksForCompany({
    companyId: user.companyId,
    employeeId: employeeScopedId(user),
    projectId: input.projectId,
    mediaSupport,
  })
}

export async function createTask(user: SessionUser, rawInput: unknown) {
  const companyId = requireCompany(user)
  assertCan(user, 'create', 'task', { companyId })

  if (!canManageWorkspace(user)) throw forbidden()

  const input: CreateTaskInput = createTaskSchema.parse(rawInput)
  const deadline = parseDate(input.deadline)

  let deliverable = input.deliverableId ? await assertDeliverableInCompany(input.deliverableId, companyId) : null
  if (!deliverable && input.projectId) {
    deliverable = await createDeliverableForTask({
      companyId,
      campaignId: input.projectId,
      title: input.title,
      description: input.description,
      type: input.deliverableType,
      dueAt: deadline,
      createdById: user.id,
    })
  }
  if (!deliverable) {
    throw badRequest('A task must belong to a deliverable. Send deliverableId, or send projectId during the migration window.')
  }

  if (input.assigneeId) {
    const assignee = await findAssignableUser(input.assigneeId, companyId)
    if (!assignee) throw notFound('Selected assignee was not found in this workspace.')
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await createTaskInTransaction(tx, {
      title: input.title,
      description: input.description,
      priority: input.priority || 'MEDIUM',
      deliverableType: input.deliverableType?.trim().toUpperCase() || 'GENERAL',
      deliverableId: deliverable.id,
      deadline,
      assigneeId: input.assigneeId,
      projectId: deliverable.campaignId,
      stage: 'TODO',
      progress: 0,
    })

    await replaceTaskDependencies(tx, created.id, input.dependencyIds)
    return created
  })

  await publishDomainEvent({
    type: 'task.created',
    companyId,
    actorId: user.id,
    entityType: 'task',
    entityId: task.id,
    action: 'Task created',
    payload: { projectId: task.project.id, task },
    after: task,
  })

  return task
}

function assertEmployeeStageTransition(currentStage: string, nextStage: string) {
  const allowedStages = EMPLOYEE_ALLOWED_STAGE_TRANSITIONS[currentStage] ?? []
  if (!allowedStages.includes(nextStage)) {
    throw forbidden('Employees can only move tasks into progress or send them to review.')
  }
}

export async function updateTask(user: SessionUser, id: string, rawInput: unknown) {
  const input: UpdateTaskInput = updateTaskSchema.parse(rawInput)
  const existing = await findTaskAccessRecord(id)
  if (!existing) throw notFound()

  if (user.companyId && existing.project.companyId !== user.companyId) throw notFound()
  const companyId = existing.project.companyId
  const role = normalizeUserRole(user.role)
  if (role === 'EMPLOYEE' && existing.assigneeId !== user.id) throw forbidden()

  const updateData: Prisma.TaskUncheckedUpdateInput = {}
  if (input.stage) {
    if (role === 'EMPLOYEE') assertEmployeeStageTransition(existing.stage, input.stage)

    updateData.stage = input.stage
    updateData.progress = getStageProgress(input.stage)

    if (input.stage === 'IN_PROGRESS') {
      const dependencyStatus = await assertTaskDependenciesSatisfied(id)
      if (!dependencyStatus.ok) throw conflict(dependencyStatus.message)
    }
  }

  if (role !== 'EMPLOYEE') {
    if (input.title) updateData.title = input.title
    if (input.description !== undefined) updateData.description = input.description
    if (input.priority) updateData.priority = input.priority
    if (input.deliverableType) updateData.deliverableType = input.deliverableType.trim().toUpperCase()
    if (input.deadline !== undefined) updateData.deadline = parseDate(input.deadline)
    if (input.assigneeId !== undefined) {
      if (input.assigneeId) {
        const assignee = await findAssignableUser(input.assigneeId, companyId)
        if (!assignee) throw notFound('Selected assignee was not found in this workspace.')
      }
      updateData.assigneeId = input.assigneeId || null
    }
    if (input.deliverableId !== undefined && input.deliverableId !== existing.deliverableId) {
      const deliverable = await assertDeliverableInCompany(input.deliverableId, companyId)
      if (!deliverable) throw notFound('Selected deliverable was not found in this workspace.')
      updateData.deliverableId = deliverable.id
      updateData.projectId = deliverable.campaignId
    } else if (input.projectId !== undefined && input.projectId !== existing.projectId) {
      const deliverable = await createDeliverableForTask({
        companyId,
        campaignId: input.projectId,
        title: input.title?.trim() || existing.title,
        description: input.description === undefined ? existing.description : input.description,
        type: input.deliverableType,
        dueAt: parseDate(input.deadline),
        createdById: user.id,
      })
      if (!deliverable) throw notFound('Selected campaign was not found in this workspace.')
      updateData.deliverableId = deliverable.id
      updateData.projectId = deliverable.campaignId
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const task = await updateTaskInTransaction(tx, id, updateData)

    if (Array.isArray(input.dependencyIds)) {
      await replaceTaskDependencies(tx, id, input.dependencyIds)
    }

    if (input.stage === 'REVIEW') {
      await tx.deliverable.update({
        where: { id: task.deliverableId },
        data: { status: 'INTERNAL_REVIEW', approvalState: 'PENDING' },
      })
    }
    if (role !== 'EMPLOYEE' && input.stage === 'DONE') {
      await tx.deliverable.update({
        where: { id: task.deliverableId },
        data: { status: 'APPROVED', approvalState: 'APPROVED', revisionCount: { increment: 1 } },
      })
      await tx.approvalDecision.create({
        data: {
          companyId,
          deliverableId: task.deliverableId,
          decidedById: user.id,
          status: 'APPROVED',
          note: input.reviewComment?.trim() || null,
        },
      })
    }
    if (role !== 'EMPLOYEE' && input.stage === 'IN_PROGRESS' && input.reviewComment?.trim()) {
      await tx.deliverable.update({
        where: { id: task.deliverableId },
        data: { status: 'INTERNAL_REVIEW', approvalState: 'CHANGES_REQUESTED' },
      })
    }

    return task
  })

  const trimmedReviewComment = input.reviewComment?.trim()
  const action =
    role !== 'EMPLOYEE' && input.stage === 'DONE'
      ? 'Review accepted'
      : role !== 'EMPLOYEE' && input.stage === 'IN_PROGRESS' && trimmedReviewComment
        ? `Review rejected: ${trimmedReviewComment}`
        : input.stage
          ? `Stage moved to ${input.stage}`
          : 'Task updated'

  await publishDomainEvent({
    type: 'task.updated',
    companyId,
    actorId: user.id,
    entityType: 'task',
    entityId: id,
    action,
    payload: { projectId: updated.project.id, task: updated, action },
    before: existing,
    after: updated,
  })

  return updated
}

export async function deleteTask(user: SessionUser, id: string) {
  const existing = await findTaskAccessRecord(id)
  if (!existing) throw notFound()
  if (user.companyId && existing.project.companyId !== user.companyId) throw notFound()
  assertCan(user, 'delete', 'task', { companyId: existing.project.companyId })
  if (!canManageWorkspace(user)) throw forbidden()

  await prisma.$transaction((tx) => deleteTasksById(tx, [id]))
  await publishDomainEvent({
    type: 'task.deleted',
    companyId: existing.project.companyId,
    actorId: user.id,
    entityType: 'task',
    entityId: id,
    action: 'Task deleted',
    payload: { projectId: existing.projectId, taskId: id },
    before: existing,
  })

  return { success: true }
}
