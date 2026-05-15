import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { badRequest } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import type { SessionUser } from '@/modules/shared/session'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { assertFinanceManage, requireFinanceCompany } from '@/modules/finance/policy'
import { writeFinancialAuditLog } from '@/modules/finance/audit.repository'
import { createJournalEntryInTransaction } from '@/modules/accounting/accounting.service'
import { normalizeCurrency, toDecimal, zeroDecimal } from '@/modules/accounting/money'
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

async function findExpensePostingAccounts(tx: Prisma.TransactionClient, companyId: string, categoryId: string | null) {
  const category = categoryId
    ? await tx.expenseCategory.findFirst({ where: { id: categoryId, companyId }, select: { defaultAccountId: true } })
    : null
  const accounts = await tx.account.findMany({
    where: { companyId, code: { in: ['1000', '2000', '2200', '5200'] }, status: 'ACTIVE', deletedAt: null },
    select: { id: true, code: true },
  })
  const byCode = new Map(accounts.map((account) => [account.code, account.id]))
  return {
    expenseAccountId: category?.defaultAccountId ?? byCode.get('5200') ?? null,
    cashAccountId: byCode.get('1000') ?? null,
    payableAccountId: byCode.get('2000') ?? null,
    taxLiabilityAccountId: byCode.get('2200') ?? null,
  }
}

export async function decideExpense(user: SessionUser, expenseId: string, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const decision = rawInput && typeof rawInput === 'object' && 'decision' in rawInput ? String((rawInput as { decision?: unknown }).decision) : 'approve'
  if (!['approve', 'reject'].includes(decision)) throw badRequest('Expense decision must be approve or reject.')
  const nextStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED'

  const expense = await prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({ where: { id: expenseId, companyId } })
    if (!existing) throw badRequest('Expense was not found in this workspace.')
    const updated = await tx.expense.update({
      where: { id: existing.id },
      data: { status: nextStatus, approvedById: decision === 'approve' ? user.id : null, approvedAt: decision === 'approve' ? new Date() : null },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: decision === 'approve' ? 'finance.expense.approved' : 'finance.expense.rejected',
      entityType: 'expense',
      entityId: existing.id,
      before: existing,
      after: updated,
    })
    return updated
  })

  return serializeExpense(expense as Awaited<ReturnType<typeof prisma.expense.findMany>>[number])
}

export async function postExpense(user: SessionUser, expenseId: string) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)

  const expense = await prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({ where: { id: expenseId, companyId } })
    if (!existing) throw badRequest('Expense was not found in this workspace.')
    if (existing.journalEntryId) return existing
    if (!['APPROVED', 'PAID', 'REIMBURSED'].includes(existing.status)) throw badRequest('Expense must be approved before journal posting.')

    const accounts = await findExpensePostingAccounts(tx, companyId, existing.categoryId)
    if (!accounts.expenseAccountId || !accounts.payableAccountId) throw badRequest('Expense and payable accounts are required before posting expenses.')
    const lines = [
      {
        accountId: accounts.expenseAccountId,
        description: existing.title,
        debit: existing.total,
        credit: zeroDecimal(),
        projectId: existing.projectId,
        clientId: existing.clientId,
        taskId: existing.taskId,
        targetType: 'expense',
        targetId: existing.id,
      },
      {
        accountId: accounts.payableAccountId,
        description: `Accrue ${existing.title}`,
        debit: zeroDecimal(),
        credit: existing.total,
        projectId: existing.projectId,
        clientId: existing.clientId,
        taskId: existing.taskId,
        targetType: 'expense_payable',
        targetId: existing.id,
      },
    ]
    const entry = await createJournalEntryInTransaction(tx, {
      companyId,
      actorId: user.id,
      sourceType: 'EXPENSE',
      sourceId: existing.id,
      memo: `Expense ${existing.title}`,
      currency: existing.currency,
      transactionDate: existing.expenseDate,
      idempotencyKey: `expense:${existing.id}:posted:v1`,
      requiresApproval: false,
      postNow: true,
      metadata: { expenseId: existing.id, vendorId: existing.vendorId },
      lines,
    })

    const updated = await tx.expense.update({
      where: { id: existing.id },
      data: { journalEntryId: entry.id, status: 'PAID' },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.expense.journal_posted',
      entityType: 'expense',
      entityId: existing.id,
      before: existing,
      after: updated,
      metadata: { journalEntryId: entry.id },
    })
    return updated
  })

  return serializeExpense(expense as Awaited<ReturnType<typeof prisma.expense.findMany>>[number])
}

export async function reimburseExpense(user: SessionUser, expenseId: string) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)

  const expense = await prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({ where: { id: expenseId, companyId } })
    if (!existing) throw badRequest('Expense was not found in this workspace.')
    if (!existing.reimbursable) throw badRequest('Only reimbursable expenses can be reimbursed.')
    const treasuryAccount = await tx.treasuryAccount.findFirst({ where: { companyId, currency: existing.currency, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } })
    if (!treasuryAccount) throw badRequest('A treasury account is required before reimbursement.')
    const txRow = await tx.treasuryTransaction.create({
      data: {
        companyId,
        fromAccountId: treasuryAccount.id,
        createdById: user.id,
        approvedById: user.id,
        status: 'POSTED',
        direction: 'OUTFLOW',
        amount: existing.total,
        currency: existing.currency,
        executedAt: new Date(),
        memo: `Reimbursement for ${existing.title}`,
        metadata: toJsonValue({ expenseId: existing.id, reimbursement: true }),
      },
    })
    await tx.treasuryAccount.update({ where: { id: treasuryAccount.id }, data: { currentBalance: { decrement: existing.total } } })
    const updated = await tx.expense.update({
      where: { id: existing.id },
      data: { status: 'REIMBURSED', paidAt: new Date(), treasuryTransactionId: txRow.id },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.expense.reimbursed',
      entityType: 'expense',
      entityId: existing.id,
      before: existing,
      after: updated,
      metadata: { treasuryTransactionId: txRow.id },
    })
    return updated
  })

  return serializeExpense(expense as Awaited<ReturnType<typeof prisma.expense.findMany>>[number])
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
