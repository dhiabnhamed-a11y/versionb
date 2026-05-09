import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const DELIVERABLE_STATUSES = ['INTERNAL_REVIEW', 'CLIENT_REVIEW', 'APPROVED', 'DELIVERED'] as const
export const APPROVAL_STATES = ['PENDING', 'CHANGES_REQUESTED', 'APPROVED'] as const

export type DeliverableLifecycleInput = {
  companyId: string
  campaignId: string
  title: string
  description?: string | null
  type?: string | null
  dueAt?: Date | null
  createdById?: string | null
}

function normalizeDeliverableType(type?: string | null) {
  return type?.trim().toUpperCase() || 'GENERAL'
}

export async function ensureImportedBriefForCampaign(input: {
  companyId: string
  campaignId: string
  clientId?: string | null
  campaignTitle?: string | null
  campaignDescription?: string | null
  createdById?: string | null
}) {
  const existing = await prisma.brief.findFirst({
    where: { companyId: input.companyId, campaignId: input.campaignId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (existing) return existing

  return prisma.brief.create({
    data: {
      companyId: input.companyId,
      campaignId: input.campaignId,
      clientId: input.clientId ?? null,
      createdById: input.createdById ?? null,
      title: `${input.campaignTitle?.trim() || 'Campaign'} brief`,
      description: input.campaignDescription ?? null,
      status: 'APPROVED',
      approvedAt: new Date(),
    },
    select: { id: true },
  })
}

export async function createDeliverableForTask(input: DeliverableLifecycleInput) {
  const campaign = await prisma.project.findFirst({
    where: { id: input.campaignId, companyId: input.companyId },
    select: { id: true, title: true, description: true, clientId: true },
  })
  if (!campaign) return null

  const brief = await ensureImportedBriefForCampaign({
    companyId: input.companyId,
    campaignId: campaign.id,
    clientId: campaign.clientId,
    campaignTitle: campaign.title,
    campaignDescription: campaign.description,
    createdById: input.createdById,
  })

  return prisma.deliverable.create({
    data: {
      companyId: input.companyId,
      campaignId: campaign.id,
      briefId: brief.id,
      title: input.title,
      description: input.description ?? null,
      type: normalizeDeliverableType(input.type),
      status: 'INTERNAL_REVIEW',
      approvalState: 'PENDING',
      dueAt: input.dueAt ?? null,
      revisions: {
        create: {
          versionNumber: 1,
          status: 'INTERNAL_REVIEW',
          changeNote: 'Initial production scope',
        },
      },
      activities: {
        create: {
          companyId: input.companyId,
          briefId: brief.id,
          actorId: input.createdById ?? null,
          type: 'deliverable.created',
          title: 'Deliverable created',
          body: input.title,
        },
      },
    },
    select: { id: true, campaignId: true, briefId: true, status: true, approvalState: true },
  })
}

export async function assertDeliverableInCompany(deliverableId: string, companyId: string) {
  return prisma.deliverable.findFirst({
    where: { id: deliverableId, companyId },
    select: {
      id: true,
      campaignId: true,
      briefId: true,
      status: true,
      approvalState: true,
    },
  })
}

export async function assertTaskDependenciesSatisfied(taskId: string) {
  const dependency = await prisma.taskDependency.findFirst({
    where: {
      taskId,
      dependsOnTask: {
        OR: [
          { stage: { not: 'DONE' } },
          { deliverable: { approvalState: { not: 'APPROVED' } } },
        ],
      },
    },
    select: {
      dependsOnTask: {
        select: {
          title: true,
          stage: true,
          deliverable: { select: { approvalState: true } },
        },
      },
    },
  })

  if (!dependency) return { ok: true as const }

  return {
    ok: false as const,
    message: `Blocked by "${dependency.dependsOnTask.title}" until its work is done and approved.`,
  }
}

export async function replaceTaskDependencies(tx: Prisma.TransactionClient, taskId: string, dependencyIds: string[]) {
  const normalized = [...new Set(dependencyIds.filter((id) => id && id !== taskId))]
  await tx.taskDependency.deleteMany({ where: { taskId } })
  if (normalized.length === 0) return

  await tx.taskDependency.createMany({
    data: normalized.map((dependsOnTaskId) => ({ taskId, dependsOnTaskId })),
    skipDuplicates: true,
  })
}
