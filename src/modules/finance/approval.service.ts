import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { badRequest, conflict, notFound } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import type { PaginationInput } from '@/modules/shared/pagination'
import type { SessionUser } from '@/modules/shared/session'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { assertFinanceApproval, assertFinanceManage, requireFinanceCompany } from '@/modules/finance/policy'
import { writeFinancialAuditLog } from '@/modules/finance/audit.repository'
import { createFinanceApprovalFlowSchema, decideFinanceApprovalStepSchema } from '@/modules/finance/approval.validation'

type TransactionClient = Prisma.TransactionClient
type FinanceApprovalEntityType = (typeof createFinanceApprovalFlowSchema._output)['entityType']

function parseOptionalDate(value: string | null | undefined, field: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid ${field}.`)
  return date
}

async function assertApprovalEntity(tx: TransactionClient, companyId: string, entityType: FinanceApprovalEntityType, entityId: string) {
  if (entityType === 'expense') return tx.expense.findFirstOrThrow({ where: { id: entityId, companyId } }).catch(() => { throw notFound('Expense not found.') })
  if (entityType === 'payroll') return tx.payroll.findFirstOrThrow({ where: { id: entityId, companyId } }).catch(() => { throw notFound('Payroll run not found.') })
  if (entityType === 'treasury_transaction') {
    return tx.treasuryTransaction.findFirstOrThrow({ where: { id: entityId, companyId } }).catch(() => { throw notFound('Treasury transaction not found.') })
  }
  if (entityType === 'invoice') return tx.invoice.findFirstOrThrow({ where: { id: entityId, companyId } }).catch(() => { throw notFound('Invoice not found.') })
  return tx.journalEntry.findFirstOrThrow({ where: { id: entityId, companyId } }).catch(() => { throw notFound('Journal entry not found.') })
}

async function markEntityPending(tx: TransactionClient, companyId: string, entityType: FinanceApprovalEntityType, entityId: string) {
  if (entityType === 'payroll') {
    await tx.payroll.updateMany({ where: { id: entityId, companyId, status: 'DRAFT' }, data: { status: 'PENDING_APPROVAL' } })
  } else if (entityType === 'treasury_transaction') {
    await tx.treasuryTransaction.updateMany({ where: { id: entityId, companyId, status: 'SCHEDULED' }, data: { status: 'PENDING_APPROVAL' } })
  } else if (entityType === 'journal_entry') {
    await tx.journalEntry.updateMany({ where: { id: entityId, companyId, status: 'DRAFT' }, data: { status: 'PENDING_APPROVAL' } })
  }
}

async function applyApprovedEntity(tx: TransactionClient, companyId: string, entityType: FinanceApprovalEntityType, entityId: string, actorId: string) {
  const now = new Date()
  if (entityType === 'expense') {
    await tx.expense.updateMany({ where: { id: entityId, companyId, status: { in: ['SUBMITTED', 'DRAFT'] } }, data: { status: 'APPROVED', approvedById: actorId, approvedAt: now } })
  } else if (entityType === 'payroll') {
    await tx.payroll.updateMany({ where: { id: entityId, companyId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } }, data: { status: 'APPROVED', approvedById: actorId, approvedAt: now } })
  } else if (entityType === 'treasury_transaction') {
    await tx.treasuryTransaction.updateMany({ where: { id: entityId, companyId, status: { in: ['SCHEDULED', 'PENDING_APPROVAL'] } }, data: { status: 'APPROVED', approvedById: actorId } })
  } else if (entityType === 'journal_entry') {
    await tx.journalEntry.updateMany({ where: { id: entityId, companyId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } }, data: { status: 'APPROVED', approvedById: actorId, approvedAt: now } })
  }
}

async function applyRejectedEntity(tx: TransactionClient, companyId: string, entityType: FinanceApprovalEntityType, entityId: string) {
  if (entityType === 'expense') {
    await tx.expense.updateMany({ where: { id: entityId, companyId, status: { in: ['SUBMITTED', 'DRAFT'] } }, data: { status: 'REJECTED' } })
  } else if (entityType === 'payroll') {
    await tx.payroll.updateMany({ where: { id: entityId, companyId, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] } }, data: { status: 'VOID' } })
  } else if (entityType === 'treasury_transaction') {
    await tx.treasuryTransaction.updateMany({ where: { id: entityId, companyId, status: { in: ['SCHEDULED', 'PENDING_APPROVAL', 'APPROVED'] } }, data: { status: 'CANCELLED' } })
  } else if (entityType === 'journal_entry') {
    await tx.journalEntry.updateMany({ where: { id: entityId, companyId, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] } }, data: { status: 'VOID' } })
  }
}

function approvalReadInclude() {
  return {
    createdBy: { select: { id: true, name: true, email: true } },
    steps: {
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { sortOrder: 'asc' as const },
    },
  }
}

export async function createFinanceApprovalFlow(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createFinanceApprovalFlowSchema.parse(rawInput)

  const flow = await prisma.$transaction(async (tx) => {
    await assertApprovalEntity(tx, companyId, input.entityType, input.entityId)

    const duplicate = await tx.approvalFlow.findFirst({
      where: {
        companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        status: { in: ['DRAFT', 'PENDING', 'ESCALATED'] },
      },
      select: { id: true },
    })
    if (duplicate) throw conflict('An active approval flow already exists for this finance record.')

    const assignedIds = [...new Set(input.steps.map((step) => step.assignedToId).filter(Boolean) as string[])]
    if (assignedIds.length) {
      const userCount = await tx.user.count({ where: { id: { in: assignedIds }, companyId } })
      if (userCount !== assignedIds.length) throw badRequest('Every approval assignee must belong to this workspace.')
    }

    const created = await tx.approvalFlow.create({
      data: {
        companyId,
        createdById: user.id,
        entityType: input.entityType,
        entityId: input.entityId,
        flowType: input.flowType,
        requiredRole: input.requiredRole?.trim() || null,
        summary: input.summary?.trim() || null,
        aiSummary: toJsonValue(input.aiSummary),
        escalatesAt: parseOptionalDate(input.escalatesAt, 'escalatesAt'),
        metadata: toJsonValue(input.metadata),
        steps: {
          create: input.steps.map((step, index) => ({
            companyId,
            assignedToId: step.assignedToId ?? null,
            sortOrder: index + 1,
            dueAt: parseOptionalDate(step.dueAt, `steps.${index}.dueAt`),
            metadata: toJsonValue(step.metadata),
          })),
        },
      },
      include: approvalReadInclude(),
    })

    await markEntityPending(tx, companyId, input.entityType, input.entityId)
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.approval_flow.created',
      entityType: 'approval_flow',
      entityId: created.id,
      after: created,
      metadata: { targetEntityType: input.entityType, targetEntityId: input.entityId },
    })

    return created
  })

  return flow
}

export async function listFinanceApprovalFlows(user: SessionUser, pagination: PaginationInput) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)

  const [items, total] = await prisma.$transaction([
    prisma.approvalFlow.findMany({
      where: { companyId },
      include: approvalReadInclude(),
      orderBy: [{ createdAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.approvalFlow.count({ where: { companyId } }),
  ])

  return {
    items,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      pageCount: Math.ceil(total / pagination.pageSize),
    },
  }
}

export async function decideFinanceApprovalStep(user: SessionUser, stepId: string, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceApproval(user)
  const input = decideFinanceApprovalStepSchema.parse(rawInput)

  const result = await prisma.$transaction(async (tx) => {
    const step = await tx.approvalStep.findFirst({
      where: { id: stepId, companyId },
      include: {
        flow: {
          include: { steps: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    })
    if (!step) throw notFound('Approval step not found.')
    if (step.status !== 'PENDING') throw conflict('Approval step has already been decided.')
    if (!['PENDING', 'ESCALATED'].includes(step.flow.status)) throw conflict('Approval flow is no longer pending.')

    const blockingStep = step.flow.steps.find((candidate) => candidate.sortOrder < step.sortOrder && candidate.status === 'PENDING')
    if (blockingStep) throw conflict('Earlier approval steps must be decided first.')

    const nextStepStatus = input.decision === 'approve' ? 'APPROVED' : 'REJECTED'
    const updatedStep = await tx.approvalStep.update({
      where: { id: step.id },
      data: {
        status: nextStepStatus,
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: input.note?.trim() || null,
        metadata: toJsonValue(input.metadata),
      },
    })

    const remainingPending = await tx.approvalStep.count({ where: { flowId: step.flowId, status: 'PENDING' } })
    const nextFlowStatus = nextStepStatus === 'REJECTED' ? 'REJECTED' : remainingPending === 0 ? 'APPROVED' : 'PENDING'

    if (nextFlowStatus === 'APPROVED') {
      await applyApprovedEntity(tx, companyId, step.flow.entityType as FinanceApprovalEntityType, step.flow.entityId, user.id)
    } else if (nextFlowStatus === 'REJECTED') {
      await applyRejectedEntity(tx, companyId, step.flow.entityType as FinanceApprovalEntityType, step.flow.entityId)
    }

    const updatedFlow = await tx.approvalFlow.update({
      where: { id: step.flowId },
      data: {
        status: nextFlowStatus,
        decidedAt: nextFlowStatus === 'APPROVED' || nextFlowStatus === 'REJECTED' ? new Date() : null,
      },
      include: approvalReadInclude(),
    })

    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: input.decision === 'approve' ? 'finance.approval_step.approved' : 'finance.approval_step.rejected',
      entityType: 'approval_step',
      entityId: step.id,
      before: step,
      after: updatedStep,
      metadata: { flowId: step.flowId, flowStatus: nextFlowStatus },
    })

    return updatedFlow
  })

  if (result.status === 'APPROVED' || result.status === 'REJECTED') {
    await publishDomainEvent({
      type: 'approval.completed',
      companyId,
      actorId: user.id,
      entityType: result.entityType,
      entityId: result.entityId,
      action: `Finance approval ${result.status.toLowerCase()}`,
      payload: { approvalFlow: result },
      after: result,
    })
  }

  return result
}
