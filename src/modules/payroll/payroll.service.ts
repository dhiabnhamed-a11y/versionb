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
import { normalizeCurrency, toDecimal, zeroDecimal, type DecimalInput } from '@/modules/accounting/money'
import { createPayrollSchema, postPayrollSchema } from '@/modules/payroll/payroll.validation'
import type { PaginationInput } from '@/modules/shared/pagination'

function parseDate(value: string, field: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid ${field}.`)
  return date
}

function decimalString(value: Prisma.Decimal) {
  return value.toString()
}

function normalizeItemType(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_')
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function decimalMetadata(value: unknown, fallback = zeroDecimal()) {
  if (value === undefined || value === null || value === '') return fallback
  if (value instanceof Prisma.Decimal || typeof value === 'string' || typeof value === 'number') return toDecimal(value as DecimalInput, 'metadata')
  return fallback
}

function percentageRate(value: unknown, fallback: string) {
  const rate = decimalMetadata(value, new Prisma.Decimal(fallback))
  return rate.div(rate.gt(1) ? 100 : 1)
}

function calculatePayrollTotals(
  items: Array<{ itemType: string; amount: Prisma.Decimal; taxable?: boolean | null }>,
  metadata: unknown
) {
  const payrollMetadata = metadataRecord(metadata)
  const employeeTaxRate = percentageRate(payrollMetadata.employeeTaxRate ?? payrollMetadata.taxRate, '0.18')
  const employerContributionRate = percentageRate(payrollMetadata.employerContributionRate, '0.09')
  const benefitContributionRate = percentageRate(payrollMetadata.benefitContributionRate, '0.04')

  const totals = items.reduce(
    (acc, item) => {
      const type = normalizeItemType(item.itemType)
      const amount = item.amount
      if (['OVERTIME'].includes(type)) acc.overtimePay = acc.overtimePay.plus(amount)
      if (['BONUS', 'COMMISSION'].includes(type)) acc.bonusPay = acc.bonusPay.plus(amount)
      if (['REIMBURSEMENT', 'EXPENSE_REIMBURSEMENT'].includes(type)) acc.reimbursements = acc.reimbursements.plus(amount)
      if (['DEDUCTION', 'BENEFIT_DEDUCTION', 'RETIREMENT_DEDUCTION', 'GARNISHMENT'].includes(type)) acc.deductions = acc.deductions.plus(amount)
      if (['BENEFIT', 'EMPLOYER_BENEFIT', 'EMPLOYER_CONTRIBUTION'].includes(type)) acc.employerContributions = acc.employerContributions.plus(amount)
      if (['TAX', 'WITHHOLDING'].includes(type)) acc.explicitTaxes = acc.explicitTaxes.plus(amount)
      if (!['DEDUCTION', 'BENEFIT_DEDUCTION', 'RETIREMENT_DEDUCTION', 'GARNISHMENT', 'TAX', 'WITHHOLDING', 'BENEFIT', 'EMPLOYER_BENEFIT', 'EMPLOYER_CONTRIBUTION'].includes(type)) {
        acc.grossPay = acc.grossPay.plus(amount)
        if (item.taxable !== false && !['REIMBURSEMENT', 'EXPENSE_REIMBURSEMENT'].includes(type)) acc.taxablePay = acc.taxablePay.plus(amount)
      }
      return acc
    },
    {
      grossPay: zeroDecimal(),
      taxablePay: zeroDecimal(),
      overtimePay: zeroDecimal(),
      bonusPay: zeroDecimal(),
      reimbursements: zeroDecimal(),
      deductions: zeroDecimal(),
      employerContributions: zeroDecimal(),
      explicitTaxes: zeroDecimal(),
    }
  )

  const computedTaxes = totals.taxablePay.minus(totals.deductions).gt(0)
    ? totals.taxablePay.minus(totals.deductions).mul(employeeTaxRate)
    : zeroDecimal()
  const taxes = totals.explicitTaxes.gt(0) ? totals.explicitTaxes : computedTaxes
  const employerContributions = totals.employerContributions.gt(0)
    ? totals.employerContributions
    : totals.taxablePay.mul(employerContributionRate).plus(totals.taxablePay.mul(benefitContributionRate))
  const netPay = totals.grossPay.plus(totals.reimbursements).minus(taxes).minus(totals.deductions)

  return {
    ...totals,
    taxes,
    employerContributions,
    netPay: netPay.gt(0) ? netPay : zeroDecimal(),
    employeeTaxRate: employeeTaxRate.toString(),
    employerContributionRate: employerContributionRate.toString(),
    benefitContributionRate: benefitContributionRate.toString(),
    country: typeof payrollMetadata.country === 'string' ? payrollMetadata.country : 'US',
  }
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
    return { ...item, itemType: normalizeItemType(item.itemType), hours, rate, amount }
  })
  const totals = calculatePayrollTotals(normalizedItems, input.metadata)

  const payroll = await prisma.$transaction(async (tx) => {
    const created = await tx.payroll.create({
      data: {
        companyId,
        processedById: user.id,
        periodStart,
        periodEnd,
        currency: normalizeCurrency(input.currency),
        grossPay: totals.grossPay,
        overtimePay: totals.overtimePay,
        bonusPay: totals.bonusPay,
        deductions: totals.deductions,
        taxes: totals.taxes,
        netPay: totals.netPay,
        metadata: toJsonValue({
          ...metadataRecord(input.metadata),
          country: totals.country,
          reimbursements: totals.reimbursements.toString(),
          employerContributions: totals.employerContributions.toString(),
          taxablePay: totals.taxablePay.toString(),
          employeeTaxRate: totals.employeeTaxRate,
          employerContributionRate: totals.employerContributionRate,
          benefitContributionRate: totals.benefitContributionRate,
          calculationModel: 'taskit_payroll_engine_v2',
        }),
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
    payload: { payrollId: payroll.id, periodStart, periodEnd, grossPay: payroll.grossPay.toString(), netPay: payroll.netPay.toString() },
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

    const metadata = metadataRecord(existing.metadata)
    const employerContributions = decimalMetadata(metadata.employerContributions)
    const taxAmount = input.taxLiabilityAccountId ? existing.taxes : zeroDecimal()
    const payrollLiabilityCredit = existing.netPay.plus(employerContributions).plus(input.taxLiabilityAccountId ? zeroDecimal() : taxAmount)
    if (payrollLiabilityCredit.isNegative()) throw conflict('Payroll liabilities cannot be negative.')
    const lines = [
      {
        accountId: input.wageExpenseAccountId,
        debit: existing.grossPay.plus(employerContributions),
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

function serializePayroll(payroll: Prisma.PayrollGetPayload<{ include: { items: true; processedBy: { select: { id: true; name: true; email: true } }; approvedBy: { select: { id: true; name: true; email: true } } } }>) {
  return {
    ...payroll,
    grossPay: decimalString(payroll.grossPay),
    overtimePay: decimalString(payroll.overtimePay),
    bonusPay: decimalString(payroll.bonusPay),
    deductions: decimalString(payroll.deductions),
    taxes: decimalString(payroll.taxes),
    netPay: decimalString(payroll.netPay),
    items: payroll.items.map((item) => ({
      ...item,
      hours: item.hours.toString(),
      rate: item.rate.toString(),
      amount: item.amount.toString(),
    })),
  }
}

export async function listPayrollRuns(user: SessionUser, pagination: PaginationInput) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)

  const include = {
    items: true,
    processedBy: { select: { id: true, name: true, email: true } },
    approvedBy: { select: { id: true, name: true, email: true } },
  } satisfies Prisma.PayrollInclude

  const [items, total] = await prisma.$transaction([
    prisma.payroll.findMany({
      where: { companyId },
      include,
      orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.payroll.count({ where: { companyId } }),
  ])

  return {
    items: items.map(serializePayroll),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      pageCount: Math.ceil(total / pagination.pageSize),
    },
  }
}
