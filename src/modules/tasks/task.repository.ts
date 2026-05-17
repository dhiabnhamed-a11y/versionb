import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type ProjectMediaSupport = {
  hasTaskSubmissionCloudinaryColumns: boolean
}

const taskBaseSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  deliverableType: true,
  deliverableId: true,
  deadline: true,
  assigneeId: true,
  projectId: true,
  stage: true,
  progress: true,
  enterpriseAssignedTeamId: true,
  enterpriseDepartmentId: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, email: true, avatar: true } },
  enterpriseAssignedTeam: { select: { id: true, name: true, code: true, queueKey: true } },
  enterpriseDepartment: { select: { id: true, name: true, code: true } },
  project: {
    select: {
      id: true,
      title: true,
      room: { select: { id: true, name: true } },
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
} satisfies Prisma.TaskSelect

function submissionSelect(mediaSupport: ProjectMediaSupport) {
  return {
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
    user: { select: { id: true, name: true } },
  } satisfies Prisma.TaskSubmissionSelect
}

export function taskListSelect(mediaSupport: ProjectMediaSupport, submissionTake: number) {
  return {
    ...taskBaseSelect,
    dependencies: {
      select: {
        dependsOnTask: { select: { id: true, title: true, stage: true } },
      },
    },
    submissions: {
      select: submissionSelect(mediaSupport),
      orderBy: { createdAt: 'desc' as const },
      take: submissionTake,
    },
    activities: {
      select: {
        id: true,
        action: true,
        createdAt: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' as const },
      take: 5,
    },
  } satisfies Prisma.TaskSelect
}

export async function listTasksForCompany(input: {
  companyId: string
  employeeId?: string | null
  projectId?: string | null
  mediaSupport: ProjectMediaSupport
}) {
  return prisma.task.findMany({
    where: {
      ...(input.employeeId ? { assigneeId: input.employeeId } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
      project: { companyId: input.companyId },
    },
    select: taskListSelect(input.mediaSupport, input.employeeId ? 6 : 3),
    orderBy: { createdAt: 'desc' },
  })
}

export async function findTaskAccessRecord(id: string) {
  return prisma.task.findUnique({
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
}

export async function findAssignableUser(userId: string, companyId: string) {
  return prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true },
  })
}

export function createTaskInTransaction(tx: Prisma.TransactionClient, input: Prisma.TaskUncheckedCreateInput) {
  return tx.task.create({
    data: input,
    select: taskBaseSelect,
  })
}

export function updateTaskInTransaction(tx: Prisma.TransactionClient, id: string, data: Prisma.TaskUncheckedUpdateInput) {
  return tx.task.update({
    where: { id },
    data,
    select: taskBaseSelect,
  })
}

export { prisma as taskRepositoryPrisma }
