import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { badRequest, conflict, notFound } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import type { SessionUser } from '@/modules/shared/session'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { assertFinanceApproval, assertFinanceManage, requireFinanceCompany } from '@/modules/finance/policy'
import { writeFinancialAuditLog } from '@/modules/finance/audit.repository'
import { createJournalEntryInTransaction } from '@/modules/accounting/accounting.service'
import { normalizeCurrency, sumDecimals, toDecimal, zeroDecimal } from '@/modules/accounting/money'
import { createPayrollSchema, postPayrollSchema } from '@/modules/payroll/payroll.validation'

function parseDate(value: string, field: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid ${field}.`)
  return date
}

function decimalString(value: Prisma.Decimal) {
  return value.toString()
}

export async function createPayrollRun(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createPayrollSchema.parse(rawInput)
  const periodStart = parseDate(input.periodStart, 'periodStart')
  const periodEnd = parseDate(input.periodEnd, 'periodEnd')
  if (periodStart > periodEnd) throw badRequest('Payroll period start must be before end.')

  const employeeIds = [...new Set(input.items.map((item) => item.employeeId))]
  const projectIds = [...new Set(input.items.map((item) => item.projectId).filter(Boolean) as string[])]
  const taskIds = [...new Set(input.items.map((item) => item.taskId).filter(Boolean) as string[])]
  const [employeeCount, projectCount, taskCount] = await Promise.all([
    prisma.user.count({ where: { id: { in: employeeIds }, companyId } }),
    projectIds.length ? prisma.project.count({ where: { id: { in: projectIds }, companyId } }) : Promise.resolve(0),
    taskIds.length ? prisma.task.count({ where: { id: { in: taskIds }, project: { companyId } } }) : Promise.resolve(0),
  ])
  if (employeeCount !== employeeIds.length) throw badRequest('Every payroll item must reference an employee in this workspace.')
  if (projectCount !== projectIds.length) throw badRequest('Every payroll project link must stay inside this workspace.')
  if (taskCount !== taskIds.length) throw badRequest('Every payroll task link must stay inside this workspace.')

  const normalizedItems = input.items.map((item) => {
    const hours = toDecimal(item.hours, 'hours')
    const rate = toDecimal(item.rate, 'rate')
    const amount = item.amount == null ? hours.mul(rate) : toDecimal(item.amount, 'amount')
    if (hours.isNegative() || rate.isNegative() || amount.isNegative()) throw badRequest('Payroll amounts cannot be negative.')
    return { ...item, hours, rate, amount }
  })
  const grossPay = sumDecimals(normalizedItems.map((item) => item.amount))

  const payroll = await prisma.$transaction(async (tx) => {
    const created = await tx.payroll.create({
      data: {
        companyId,
        processedById: user.id,
        periodStart,
        periodEnd,
        currency: normalizeCurrency(input.currency),
        grossPay,
        netPay: grossPay,
        metadata: toJsonValue(input.metadata),
        items: {
          create: normalizedItems.map((item) => ({
            companyId,
            employeeId: item.employeeId,
            projectId: item.projectId ?? null,
            taskId: item.taskId ?? null,
            itemType: item.itemType,
            description: item.description?.trim() || null,
            hours: item.hours,
            rate: item.rate,
            amount: item.amount,
            taxable: item.taxable ?? true,
            metadata: toJsonValue(item.metadata),
          })),
        },
      },
      include: { items: true },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.payroll.created',
      entityType: 'payroll',
      entityId: created.id,
      after: created,
    })
    return created
  })

  await publishDomainEvent({
    type: 'finance.payroll.created',
    companyId,
    actorId: user.id,
    entityType: 'payroll',
    entityId: payroll.id,
    action: 'Payroll run created',
    payload: { payrollId: payroll.id, periodStart, periodEnd },
    after: { id: payroll.id },
  })

  return {
    ...payroll,
    grossPay: decimalString(payroll.grossPay),
    netPay: decimalString(payroll.netPay),
    items: payroll.items.map((item) => ({ ...item, hours: item.hours.toString(), rate: item.rate.toString(), amount: item.amount.toString() })),
  }
}

export async function postPayrollRun(user: SessionUser, payrollId: string, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceApproval(user)
  const input = postPayrollSchema.parse(rawInput)

  const payroll = await prisma.$transaction(async (tx) => {
    const existing = await tx.payroll.findFirst({ where: { id: payrollId, companyId }, include: { items: true } })
    if (!existing) throw notFound('Payroll run not found.')
    if (existing.journalEntryId) throw conflict('Payroll run is already linked to a journal entry.')
    if (existing.grossPay.lte(0)) throw badRequest('Payroll run must have positive gross pay before posting.')

    const taxAmount = input.taxLiabilityAccountId ? existing.taxes : zeroDecimal()
    const payrollLiabilityCredit = existing.grossPay.minus(taxAmount)
    if (payrollLiabilityCredit.isNegative()) throw conflict('Payroll tax amount cannot exceed gross pay.')
    const lines = [
      {
        accountId: input.wageExpenseAccountId,
        debit: existing.grossPay,
        credit: zeroDecimal(),
        targetType: 'payroll',
        targetId: existing.id,
      },
      {
        accountId: input.payrollLiabilityAccountId,
        debit: zeroDecimal(),
        credit: payrollLiabilityCredit,
        targetType: 'payroll',
        targetId: existing.id,
      },
    ]
    if (input.taxLiabilityAccountId && taxAmount.gt(0)) {
      lines.push({
        accountId: input.taxLiabilityAccountId,
        debit: zeroDecimal(),
        credit: taxAmount,
        targetType: 'payroll_tax',
        targetId: existing.id,
      })
    }

    const entry = await createJournalEntryInTransaction(tx, {
      companyId,
      actorId: user.id,
      sourceType: 'PAYROLL',
      sourceId: existing.id,
      memo: `Payroll ${existing.periodStart.toISOString().slice(0, 10)} to ${existing.periodEnd.toISOString().slice(0, 10)}`,
      currency: existing.currency,
      transactionDate: existing.periodEnd,
      requiresApproval: false,
      postNow: true,
      metadata: { payrollId: existing.id },
      lines,
    })

    const updated = await tx.payroll.update({
      where: { id: existing.id },
      data: { status: 'POSTED', approvedById: user.id, approvedAt: new Date(), postedAt: new Date(), journalEntryId: entry.id },
      include: { items: true },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.payroll.posted',
      entityType: 'payroll',
      entityId: updated.id,
      before: existing,
      after: updated,
      metadata: { journalEntryId: entry.id },
    })
    return updated
  })

  return {
    ...payroll,
    grossPay: decimalString(payroll.grossPay),
    netPay: decimalString(payroll.netPay),
    items: payroll.items.map((item) => ({ ...item, hours: item.hours.toString(), rate: item.rate.toString(), amount: item.amount.toString() })),
  }
}
