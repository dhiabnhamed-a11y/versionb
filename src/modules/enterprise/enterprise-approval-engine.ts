import { Prisma } from '@prisma/client'
import { enterpriseRepositoryPrisma, enterpriseRepositoryTransaction } from '@/modules/enterprise/enterprise.repository'
import { recordEnterpriseAuditTx } from '@/modules/enterprise/enterprise-audit'

export type StepType = 'SINGLE' | 'ANY' | 'ALL'
export type StepDecision = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED'

export interface ApprovalStepDef {
  stepIndex: number
  stepType: StepType
  label: string
  assigneeId?: string | null
  teamId?: string | null
  order: number
  timeoutHours: number
  budgetCheck?: { maxAmount: number; currency: string } | null
}

export interface ApprovalWorkflowResult {
  completed: boolean
  approved: boolean
  finalState: string
}

export async function startApprovalWorkflow(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string
    entityType: string
    entityId: string
    requestedById: string
    steps: ApprovalStepDef[]
  }
) {
  for (const step of input.steps) {
    await tx.enterpriseApprovalStep.create({
      data: {
        companyId: input.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        stepIndex: step.stepIndex,
        stepType: step.stepType,
        label: step.label,
        assigneeId: step.assigneeId ?? null,
        teamId: step.teamId ?? null,
        order: step.order,
        decision: 'PENDING',
        timeoutHours: step.timeoutHours,
        budgetCheck: step.budgetCheck as Prisma.InputJsonValue | undefined,
        decidedById: null,
        decidedAt: null,
        comments: null,
      },
    })
  }

  await recordEnterpriseAuditTx(tx, {
    companyId: input.companyId,
    actorId: input.requestedById,
    action: 'enterprise.approval.workflow_started',
    entityType: input.entityType,
    entityId: input.entityId,
    after: { steps: input.steps.length },
  })
}

export async function approveStep(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string
    stepId: string
    decidedById: string
    comments?: string | null
  }
): Promise<ApprovalWorkflowResult> {
  const step = await tx.enterpriseApprovalStep.findFirst({
    where: { id: input.stepId, companyId: input.companyId, decision: 'PENDING' },
  })
  if (!step) throw Object.assign(new Error('Approval step not found or already decided.'), { status: 404 })

  await tx.enterpriseApprovalStep.update({
    where: { id: input.stepId },
    data: { decision: 'APPROVED', decidedById: input.decidedById, decidedAt: new Date(), comments: input.comments ?? null },
  })

  await recordEnterpriseAuditTx(tx, {
    companyId: input.companyId,
    actorId: input.decidedById,
    action: 'enterprise.approval.step_approved',
    entityType: step.entityType,
    entityId: step.entityId,
    before: { decision: 'PENDING', stepIndex: step.stepIndex, label: step.label },
    after: { decision: 'APPROVED', stepIndex: step.stepIndex, label: step.label },
  })

  return checkWorkflowCompletion(tx, { companyId: input.companyId, entityType: step.entityType, entityId: step.entityId })
}

export async function rejectStep(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string
    stepId: string
    decidedById: string
    comments?: string | null
  }
): Promise<ApprovalWorkflowResult> {
  const step = await tx.enterpriseApprovalStep.findFirst({
    where: { id: input.stepId, companyId: input.companyId, decision: 'PENDING' },
  })
  if (!step) throw Object.assign(new Error('Approval step not found or already decided.'), { status: 404 })

  const stepType = (step.stepType || 'SINGLE') as StepType

  if (stepType === 'ALL') {
    const pending = await tx.enterpriseApprovalStep.count({
      where: { entityType: step.entityType, entityId: step.entityId, decision: 'PENDING' },
    })
    if (pending > 1) {
      throw Object.assign(new Error('ALL-type workflow requires all pending steps to be decided at once.'), { status: 400 })
    }
  }

  await tx.enterpriseApprovalStep.update({
    where: { id: input.stepId },
    data: { decision: 'REJECTED', decidedById: input.decidedById, decidedAt: new Date(), comments: input.comments ?? null },
  })

  await recordEnterpriseAuditTx(tx, {
    companyId: input.companyId,
    actorId: input.decidedById,
    action: 'enterprise.approval.step_rejected',
    entityType: step.entityType,
    entityId: step.entityId,
    before: { decision: 'PENDING', stepIndex: step.stepIndex, label: step.label },
    after: { decision: 'REJECTED', stepIndex: step.stepIndex, label: step.label },
  })

  return checkWorkflowCompletion(tx, { companyId: input.companyId, entityType: step.entityType, entityId: step.entityId })
}

export async function escalateStep(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string
    stepId: string
    decidedById: string
    comments?: string | null
  }
): Promise<ApprovalWorkflowResult> {
  const step = await tx.enterpriseApprovalStep.findFirst({
    where: { id: input.stepId, companyId: input.companyId, decision: 'PENDING' },
  })
  if (!step) throw Object.assign(new Error('Approval step not found or already decided.'), { status: 404 })

  await tx.enterpriseApprovalStep.update({
    where: { id: input.stepId },
    data: { decision: 'ESCALATED', decidedById: input.decidedById, decidedAt: new Date(), comments: input.comments ?? null },
  })

  await recordEnterpriseAuditTx(tx, {
    companyId: input.companyId,
    actorId: input.decidedById,
    action: 'enterprise.approval.step_escalated',
    entityType: step.entityType,
    entityId: step.entityId,
    before: { decision: 'PENDING', stepIndex: step.stepIndex, label: step.label },
    after: { decision: 'ESCALATED', stepIndex: step.stepIndex, label: step.label },
  })

  return checkWorkflowCompletion(tx, { companyId: input.companyId, entityType: step.entityType, entityId: step.entityId })
}

export async function checkWorkflowCompletion(
  tx: Prisma.TransactionClient,
  input: { companyId: string; entityType: string; entityId: string }
): Promise<ApprovalWorkflowResult> {
  const steps = await tx.enterpriseApprovalStep.findMany({
    where: { entityType: input.entityType, entityId: input.entityId },
    orderBy: { order: 'asc' },
  })

  if (steps.length === 0) {
    return { completed: true, approved: false, finalState: 'NO_STEPS' }
  }

  const hasRejected = steps.some((s) => s.decision === 'REJECTED')
  if (hasRejected) {
    return { completed: true, approved: false, finalState: 'REJECTED' }
  }

  const hasPending = steps.some((s) => s.decision === 'PENDING')
  if (!hasPending) {
    return { completed: true, approved: true, finalState: 'APPROVED' }
  }

  return { completed: false, approved: false, finalState: 'PENDING' }
}

export async function getApprovalWorkflowStatus(
  entityType: string,
  entityId: string
) {
  const steps = await enterpriseRepositoryPrisma.enterpriseApprovalStep.findMany({
    where: { entityType, entityId },
    orderBy: { order: 'asc' },
    include: {
      decidedBy: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true } },
    },
  })

  const total = steps.length
  const decided = steps.filter((s) => s.decision !== 'PENDING').length
  const approved = steps.filter((s) => s.decision === 'APPROVED').length
  const rejected = steps.filter((s) => s.decision === 'REJECTED').length

  return {
    steps,
    summary: { total, decided, approved, rejected, pending: total - decided },
    completed: !steps.some((s) => s.decision === 'PENDING'),
  }
}
