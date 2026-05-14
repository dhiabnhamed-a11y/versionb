import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { badRequest } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import type { SessionUser } from '@/modules/shared/session'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { assertFinanceManage, requireFinanceCompany } from '@/modules/finance/policy'
import { writeFinancialAuditLog } from '@/modules/finance/audit.repository'
import { normalizeCurrency, toDecimal } from '@/modules/accounting/money'
import { createExpenseSchema } from '@/modules/expenses/expense.validation'
import type { PaginationInput } from '@/modules/shared/pagination'

function parseDate(value: string | null | undefined) {
  if (!value) return new Date()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest('Invalid expense date.')
  return date
}

async function assertExpenseLinks(companyId: string, input: { vendorId?: string | null; categoryId?: string | null; projectId?: string | null; taskId?: string | null; clientId?: string | null }) {
  const [vendor, category, project, task, client] = await Promise.all([
    input.vendorId ? prisma.vendor.findFirst({ where: { id: input.vendorId, companyId }, select: { id: true } }) : Promise.resolve(null),
    input.categoryId ? prisma.expenseCategory.findFirst({ where: { id: input.categoryId, companyId }, select: { id: true } }) : Promise.resolve(null),
    input.projectId ? prisma.project.findFirst({ where: { id: input.projectId, companyId }, select: { id: true, clientId: true } }) : Promise.resolve(null),
    input.taskId ? prisma.task.findFirst({ where: { id: input.taskId, project: { companyId } }, select: { id: true, projectId: true } }) : Promise.resolve(null),
    input.clientId ? prisma.client.findFirst({ where: { id: input.clientId, companyId }, select: { id: true } }) : Promise.resolve(null),
  ])

  if (input.vendorId && !vendor) throw badRequest('Selected vendor was not found in this workspace.')
  if (input.categoryId && !category) throw badRequest('Selected expense category was not found in this workspace.')
  if (input.projectId && !project) throw badRequest('Selected project was not found in this workspace.')
  if (input.taskId && !task) throw badRequest('Selected task was not found in this workspace.')
  if (input.clientId && !client) throw badRequest('Selected client was not found in this workspace.')
  if (task && project && task.projectId !== project.id) throw badRequest('Selected task does not belong to the selected project.')

  return { clientId: input.clientId ?? project?.clientId ?? null }
}

export async function createExpense(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createExpenseSchema.parse(rawInput)
  const links = await assertExpenseLinks(companyId, input)
  const subtotal = toDecimal(input.subtotal, 'subtotal')
  const taxTotal = toDecimal(input.taxTotal, 'taxTotal')
  const total = input.total == null ? subtotal.plus(taxTotal) : toDecimal(input.total, 'total')
  if (subtotal.isNegative() || taxTotal.isNegative() || total.isNegative()) throw badRequest('Expense amounts cannot be negative.')

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        companyId,
        vendorId: input.vendorId ?? null,
        categoryId: input.categoryId ?? null,
        submittedById: user.id,
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
        clientId: links.clientId,
        title: input.title,
        description: input.description?.trim() || null,
        status: 'SUBMITTED',
        expenseDate: parseDate(input.expenseDate),
        submittedAt: new Date(),
        currency: normalizeCurrency(input.currency),
        subtotal,
        taxTotal,
        total,
        reimbursable: input.reimbursable ?? false,
        receiptUrl: input.receiptUrl?.trim() || null,
        receiptOcrStatus: input.receiptUrl ? 'READY_FOR_OCR' : 'NOT_REQUESTED',
        recurrenceRule: toJsonValue(input.recurrenceRule),
        metadata: toJsonValue(input.metadata),
      },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.expense.created',
      entityType: 'expense',
      entityId: created.id,
      after: created,
    })
    return created
  })

  await publishDomainEvent({
    type: 'finance.expense.created',
    companyId,
    actorId: user.id,
    entityType: 'expense',
    entityId: expense.id,
    action: `Expense ${expense.title} submitted`,
    payload: { expense },
    after: expense,
  })

  return {
    ...expense,
    subtotal: (expense.subtotal as Prisma.Decimal).toString(),
    taxTotal: (expense.taxTotal as Prisma.Decimal).toString(),
    total: (expense.total as Prisma.Decimal).toString(),
  }
}

function serializeExpense(expense: Awaited<ReturnType<typeof prisma.expense.findMany>>[number]) {
  return {
    ...expense,
    subtotal: (expense.subtotal as Prisma.Decimal).toString(),
    taxTotal: (expense.taxTotal as Prisma.Decimal).toString(),
    total: (expense.total as Prisma.Decimal).toString(),
    aiCategoryConfidence: expense.aiCategoryConfidence?.toString() ?? null,
  }
}

export async function listExpenses(user: SessionUser, pagination: PaginationInput) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)

  const [items, total] = await prisma.$transaction([
    prisma.expense.findMany({
      where: { companyId },
      include: {
        vendor: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
        client: { select: { id: true, companyName: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.expense.count({ where: { companyId } }),
  ])

  return {
    items: items.map(serializeExpense),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      pageCount: Math.ceil(total / pagination.pageSize),
    },
  }
}
