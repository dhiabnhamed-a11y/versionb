import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { badRequest, notFound } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import type { SessionUser } from '@/modules/shared/session'
import { assertFinanceRead, requireFinanceCompany } from '@/modules/finance/policy'
import { toDecimal, zeroDecimal } from '@/modules/accounting/money'

function parseDate(value: string, field: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid ${field}.`)
  return date
}

function decimalToString(value: Prisma.Decimal) {
  return value.toString()
}

export async function computeProjectProfitabilitySnapshot(user: SessionUser, input: { projectId: string; periodStart: string; periodEnd: string }) {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)
  const periodStart = parseDate(input.periodStart, 'periodStart')
  const periodEnd = parseDate(input.periodEnd, 'periodEnd')
  if (periodStart > periodEnd) throw badRequest('Profitability period start must be before end.')

  const project = await prisma.project.findFirst({ where: { id: input.projectId, companyId }, select: { id: true, title: true, clientId: true } })
  if (!project) throw notFound('Project not found.')

  const [invoiceTotals, expenseTotals, timeEntries, deliverables] = await Promise.all([
    prisma.invoice.aggregate({
      where: { companyId, campaignId: project.id, status: { in: ['sent', 'paid', 'overdue'] }, issueDate: { gte: periodStart, lte: periodEnd } },
      _sum: { total: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, projectId: project.id, status: { in: ['APPROVED', 'PAID', 'REIMBURSED'] }, expenseDate: { gte: periodStart, lte: periodEnd } },
      _sum: { total: true },
    }),
    prisma.timeEntry.findMany({
      where: { companyId, projectId: project.id, status: { in: ['APPROVED', 'BILLED', 'LOCKED'] }, workDate: { gte: periodStart, lte: periodEnd } },
      select: { hours: true, costRate: true },
    }),
    prisma.deliverable.findMany({
      where: { companyId, campaignId: project.id },
      select: { revisionCount: true, updatedAt: true },
    }),
  ])

  const revenue = toDecimal(invoiceTotals._sum.total ?? 0, 'revenue')
  const expenseCost = toDecimal(expenseTotals._sum.total ?? 0, 'expenseCost')
  const laborCost = timeEntries.reduce((total, entry) => {
    if (!entry.costRate) return total
    return total.plus(entry.hours.mul(entry.costRate))
  }, zeroDecimal())
  const grossProfit = revenue.minus(laborCost).minus(expenseCost)
  const grossMarginPercent = revenue.gt(0) ? grossProfit.div(revenue).mul(100) : zeroDecimal()
  const revisionCount = deliverables.reduce((total, deliverable) => total + deliverable.revisionCount, 0)
  const revisionCostImpact = revisionCount > 1 ? laborCost.mul(new Prisma.Decimal(Math.min(revisionCount - 1, 20))).mul(0.05) : zeroDecimal()
  const marginLeakage = grossProfit.isNegative() ? grossProfit.abs() : revisionCostImpact

  const snapshot = await prisma.profitabilitySnapshot.create({
    data: {
      companyId,
      scope: 'PROJECT',
      projectId: project.id,
      clientId: project.clientId,
      periodStart,
      periodEnd,
      revenue,
      laborCost,
      expenseCost,
      grossProfit,
      grossMarginPercent,
      revisionCostImpact,
      marginLeakage,
      evidence: toJsonValue({
        projectTitle: project.title,
        invoiceRevenue: revenue.toString(),
        approvedExpenseCost: expenseCost.toString(),
        approvedLaborEntries: timeEntries.length,
        revisionCount,
      }),
    },
  })

  return {
    ...snapshot,
    revenue: decimalToString(snapshot.revenue),
    laborCost: decimalToString(snapshot.laborCost),
    expenseCost: decimalToString(snapshot.expenseCost),
    grossProfit: decimalToString(snapshot.grossProfit),
    grossMarginPercent: decimalToString(snapshot.grossMarginPercent),
    revisionCostImpact: decimalToString(snapshot.revisionCostImpact),
    approvalDelayCost: decimalToString(snapshot.approvalDelayCost),
    marginLeakage: decimalToString(snapshot.marginLeakage),
  }
}
