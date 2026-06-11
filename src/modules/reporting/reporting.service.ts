import { tenantQueryRaw } from '@/lib/tenant/tenant-raw-query';
import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { assertFinanceRead, requireFinanceCompany } from '@/modules/finance/policy'
import { normalizeCurrency, zeroDecimal } from '@/modules/accounting/money'
import type { SessionUser } from '@/modules/shared/session'
import { badRequest } from '@/modules/shared/errors'
import {
  getClientExposureRows,
  getLedgerRows,
  getMonthlyOperatingRows,
  getReceivablesAgingRows,
} from '@/modules/reporting/reporting.repository'
import type {
  ExecutiveFinanceInsight,
  FinancialOperatingSystemDashboard,
  FinancialReport,
  FinancialReportKind,
  MoneyPoint,
} from '@/modules/reporting/types'

type DecimalLike = Prisma.Decimal | number | string | bigint | null | undefined

function decimal(value: DecimalLike) {
  if (typeof value === 'bigint') return new Prisma.Decimal(value.toString())
  try {
    return new Prisma.Decimal(value ?? 0)
  } catch {
    return zeroDecimal()
  }
}

function numberValue(value: DecimalLike) {
  return decimal(value).toNumber()
}

function money(value: DecimalLike) {
  return decimal(value).toFixed(2)
}

function ratio(numerator: DecimalLike, denominator: DecimalLike) {
  const nextDenominator = decimal(denominator)
  if (!nextDenominator.gt(0)) return 0
  return decimal(numerator).div(nextDenominator).mul(100).toDecimalPlaces(1).toNumber()
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999))
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

function statusSum(
  rows: Array<{ status: string; _sum: { total?: Prisma.Decimal | null; grossPay?: Prisma.Decimal | null }; _count?: { id?: number } }>,
  statuses: string[],
  field: 'total' | 'grossPay' = 'total'
) {
  return rows
    .filter((row) => statuses.includes(row.status))
    .reduce((total, row) => total.plus(row._sum[field] ?? zeroDecimal()), zeroDecimal())
}

function buildRecommendations(input: {
  cashBalance: Prisma.Decimal
  monthlyBurn: Prisma.Decimal
  runwayMonths: number | null
  openReceivables: Prisma.Decimal
  overdueReceivables: Prisma.Decimal
  payrollRevenueRatio: number
  clientConcentrationPercent: number
  grossMarginPercent: number
  budgetVariance: Prisma.Decimal
}): ExecutiveFinanceInsight[] {
  const insights: ExecutiveFinanceInsight[] = []

  if (input.runwayMonths !== null && input.runwayMonths < 6) {
    insights.push({
      severity: input.runwayMonths < 3 ? 'CRITICAL' : 'WATCH',
      title: 'Runway pressure is emerging',
      narrative: `Current cash and burn imply ${input.runwayMonths.toFixed(1)} months of runway.`,
      recommendation: 'Prioritize collections, delay discretionary spend, and review payroll commitments before approving new outflows.',
      evidence: {
        cashBalance: money(input.cashBalance),
        monthlyBurn: money(input.monthlyBurn),
        runwayMonths: input.runwayMonths,
      },
    })
  }

  if (input.overdueReceivables.gt(0)) {
    insights.push({
      severity: input.overdueReceivables.div(input.openReceivables.gt(0) ? input.openReceivables : 1).gt(0.35) ? 'CRITICAL' : 'WATCH',
      title: 'Collections risk is affecting treasury quality',
      narrative: `${money(input.overdueReceivables)} of receivables are overdue.`,
      recommendation: 'Move overdue accounts into a collections sequence and require executive review for additional work on exposed clients.',
      evidence: {
        openReceivables: money(input.openReceivables),
        overdueReceivables: money(input.overdueReceivables),
      },
    })
  }

  if (input.payrollRevenueRatio > 55) {
    insights.push({
      severity: input.payrollRevenueRatio > 75 ? 'CRITICAL' : 'WATCH',
      title: 'Payroll is consuming too much operating revenue',
      narrative: `Payroll equals ${input.payrollRevenueRatio}% of recognized revenue in the current operating window.`,
      recommendation: 'Compare payroll growth against revenue growth and review low-margin projects before expanding team capacity.',
      evidence: { payrollRevenueRatio: input.payrollRevenueRatio },
    })
  }

  if (input.clientConcentrationPercent > 45) {
    insights.push({
      severity: input.clientConcentrationPercent > 60 ? 'CRITICAL' : 'WATCH',
      title: 'Treasury exposure is concentrated',
      narrative: `Top-client exposure represents ${input.clientConcentrationPercent}% of open receivables.`,
      recommendation: 'Diversify collection focus and avoid allowing one client relationship to dominate working capital risk.',
      evidence: { clientConcentrationPercent: input.clientConcentrationPercent },
    })
  }

  if (input.grossMarginPercent < 35) {
    insights.push({
      severity: input.grossMarginPercent < 20 ? 'CRITICAL' : 'WATCH',
      title: 'Margin quality is below target',
      narrative: `Gross margin is running at ${input.grossMarginPercent}%.`,
      recommendation: 'Inspect project scope changes, delivery rework, contractor spend, and client approval delays for margin leakage.',
      evidence: { grossMarginPercent: input.grossMarginPercent },
    })
  }

  if (input.budgetVariance.gt(0)) {
    insights.push({
      severity: 'WATCH',
      title: 'Spend is running above operating plan',
      narrative: `Current actuals are ${money(input.budgetVariance)} above active budget coverage.`,
      recommendation: 'Review budget owners, freeze nonessential categories, and require approval for spend above plan.',
      evidence: { budgetVariance: money(input.budgetVariance) },
    })
  }

  if (!insights.length) {
    insights.push({
      severity: 'INFO',
      title: 'Financial operating posture is stable',
      narrative: 'No critical receivables, margin, concentration, or runway risks are visible in the current operating window.',
      recommendation: 'Keep posting financial events and refreshing profitability snapshots so CFO intelligence remains current.',
      evidence: {},
    })
  }

  return insights
}

export async function getFinancialOperatingSystemDashboard(user: SessionUser): Promise<FinancialOperatingSystemDashboard> {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)

  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const trendStart = addMonths(currentMonthStart, -5)

  const [
    invoiceStatusRows,
    currentInvoiceRows,
    expenseStatusRows,
    currentExpenseTotal,
    payrollStatusRows,
    currentPayrollTotal,
    treasuryBalances,
    openApprovals,
    postedJournals,
    activeBudgetTotal,
    latestProfitability,
    monthlyRows,
    clientRows,
    agingRows,
    deliveryToCashRows,
  ] = await Promise.all([
    prisma.invoice.groupBy({
      by: ['status', 'currency'],
      where: { companyId },
      _sum: { total: true, subtotal: true, taxTotal: true },
      _count: { id: true },
    }),
    prisma.invoice.aggregate({
      where: { companyId, status: 'paid', paidAt: { gte: currentMonthStart } },
      _sum: { total: true, subtotal: true },
    }),
    prisma.expense.groupBy({
      by: ['status', 'currency'],
      where: { companyId },
      _sum: { total: true, subtotal: true, taxTotal: true },
      _count: { id: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, expenseDate: { gte: currentMonthStart }, status: { notIn: ['REJECTED', 'VOID'] } },
      _sum: { total: true },
    }),
    prisma.payroll.groupBy({
      by: ['status', 'currency'],
      where: { companyId },
      _sum: { grossPay: true, netPay: true },
      _count: { id: true },
    }),
    prisma.payroll.aggregate({
      where: { companyId, periodEnd: { gte: currentMonthStart }, status: { not: 'VOID' } },
      _sum: { grossPay: true },
    }),
    prisma.treasuryAccount.groupBy({
      by: ['currency'],
      where: { companyId, status: 'ACTIVE' },
      _sum: { currentBalance: true },
    }),
    prisma.approvalFlow.count({ where: { companyId, status: { in: ['PENDING', 'ESCALATED'] } } }),
    prisma.journalEntry.count({ where: { companyId, status: 'POSTED' } }),
    prisma.budget.aggregate({
      where: {
        companyId,
        status: 'ACTIVE',
        OR: [
          { startsAt: null, endsAt: null },
          { startsAt: { lte: now }, endsAt: null },
          { startsAt: null, endsAt: { gte: now } },
          { startsAt: { lte: now }, endsAt: { gte: now } },
        ],
      },
      _sum: { totalAmount: true },
    }),
    prisma.profitabilitySnapshot.findFirst({
      where: { companyId },
      orderBy: { computedAt: 'desc' },
      select: { grossProfit: true, grossMarginPercent: true, marginLeakage: true },
    }),
    getMonthlyOperatingRows(companyId, trendStart),
    getClientExposureRows(companyId, trendStart),
    getReceivablesAgingRows(companyId, now),
    tenantQueryRaw<Array<{ days: Prisma.Decimal | number | string | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM ("paidAt" - "issueDate")) / 86400) AS days
      FROM "Invoice"
      WHERE "companyId" = ${companyId}
        AND status = 'paid'
        AND "paidAt" IS NOT NULL
        AND "issueDate" >= ${trendStart}
    `,
  ])

  const primaryCurrency =
    treasuryBalances[0]?.currency ??
    invoiceStatusRows[0]?.currency ??
    expenseStatusRows[0]?.currency ??
    payrollStatusRows[0]?.currency ??
    'USD'

  const cashBalance = treasuryBalances.reduce((total, row) => total.plus(row._sum.currentBalance ?? zeroDecimal()), zeroDecimal())
  const openReceivables = statusSum(invoiceStatusRows, ['sent', 'viewed', 'partially_paid', 'overdue', 'disputed', 'escalated'])
  const overdueReceivables = statusSum(invoiceStatusRows, ['overdue', 'disputed', 'escalated'])
  const paidRevenue = statusSum(invoiceStatusRows, ['paid'])
  const draftPipeline = statusSum(invoiceStatusRows, ['draft', 'internal_review', 'pending_approval', 'approved'])
  const expenseExposure = statusSum(expenseStatusRows, ['SUBMITTED', 'APPROVED', 'PAID', 'REIMBURSED'])
  const accountsPayableExposure = statusSum(expenseStatusRows, ['SUBMITTED', 'APPROVED'])
  const payrollExposure = statusSum(payrollStatusRows, ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'], 'grossPay')
  const currentRevenue = decimal(currentInvoiceRows._sum.total)
  const currentExpenses = decimal(currentExpenseTotal._sum.total)
  const currentPayroll = decimal(currentPayrollTotal._sum.grossPay)
  const currentOperatingCosts = currentExpenses.plus(currentPayroll)
  const netProfit = currentRevenue.minus(currentOperatingCosts)
  const grossProfit = latestProfitability?.grossProfit ?? currentRevenue.minus(currentPayroll)
  const grossMarginPercent = latestProfitability ? Number(latestProfitability.grossMarginPercent.toFixed(1)) : ratio(grossProfit, currentRevenue)
  const monthlyBurn = currentOperatingCosts.minus(currentRevenue).gt(0) ? currentOperatingCosts.minus(currentRevenue) : zeroDecimal()
  const runwayMonths = monthlyBurn.gt(0) ? cashBalance.div(monthlyBurn).toDecimalPlaces(1).toNumber() : null
  const budgetVariance = currentOperatingCosts.minus(activeBudgetTotal._sum.totalAmount ?? zeroDecimal())
  const safeBudgetVariance = budgetVariance.gt(0) ? budgetVariance : zeroDecimal()
  const payrollRevenueRatio = ratio(currentPayroll, currentRevenue)
  const topClientExposure = clientRows[0] ? decimal(clientRows[0].exposure) : zeroDecimal()
  const clientConcentrationPercent = ratio(topClientExposure, openReceivables)
  const deliveryToCashDays = deliveryToCashRows[0]?.days == null ? null : Math.round(numberValue(deliveryToCashRows[0].days) * 10) / 10

  const monthly: MoneyPoint[] = monthlyRows.map((row) => {
    const month = new Date(row.month)
    const revenue = decimal(row.revenue)
    const expenses = decimal(row.expenses)
    const payroll = decimal(row.payroll)
    return {
      label: monthLabel(month),
      periodStart: startOfMonth(month).toISOString(),
      periodEnd: endOfMonth(month).toISOString(),
      revenue: money(revenue),
      expenses: money(expenses),
      payroll: money(payroll),
      netCashflow: money(revenue.minus(expenses).minus(payroll)),
    }
  })

  const aging = {
    current: '0.00',
    days1To30: '0.00',
    days31To60: '0.00',
    days61To90: '0.00',
    over90: '0.00',
  }
  for (const row of agingRows) {
    if (row.bucket in aging) aging[row.bucket as keyof typeof aging] = money(row.total)
  }

  const financialHealthScore = Math.max(
    18,
    Math.min(
      98,
      Math.round(
        76 +
          (cashBalance.gt(0) ? 7 : -8) +
          (postedJournals ? 5 : -9) +
          (runwayMonths === null ? 5 : Math.min(runwayMonths * 1.6, 10)) -
          (overdueReceivables.gt(0) ? Math.min(ratio(overdueReceivables, openReceivables) / 3, 16) : 0) -
          (payrollRevenueRatio > 55 ? Math.min((payrollRevenueRatio - 55) / 2, 14) : 0) -
          (grossMarginPercent < 35 ? Math.min((35 - grossMarginPercent) / 2, 12) : 0)
      )
    )
  )

  const recommendations = buildRecommendations({
    cashBalance,
    monthlyBurn,
    runwayMonths,
    openReceivables,
    overdueReceivables,
    payrollRevenueRatio,
    clientConcentrationPercent,
    grossMarginPercent,
    budgetVariance: safeBudgetVariance,
  })

  return {
    generatedAt: now.toISOString(),
    model: 'taskit-financial-operating-system-v1',
    metrics: {
      primaryCurrency,
      financialHealthScore,
      cashBalance: money(cashBalance),
      openReceivables: money(openReceivables),
      overdueReceivables: money(overdueReceivables),
      paidRevenue: money(paidRevenue),
      draftPipeline: money(draftPipeline),
      expenseExposure: money(expenseExposure),
      payrollExposure: money(payrollExposure),
      openApprovals,
      postedJournals,
      grossProfit: money(grossProfit),
      netProfit: money(netProfit),
      grossMarginPercent,
      monthlyBurn: money(monthlyBurn),
      runwayMonths,
      accountsReceivableExposure: money(openReceivables),
      accountsPayableExposure: money(accountsPayableExposure),
      budgetVariance: money(safeBudgetVariance),
      deliveryToCashDays,
      payrollRevenueRatio,
      clientConcentrationPercent,
    },
    trends: { monthly },
    aging,
    topClients: clientRows.map((row) => {
      const paidCount = Number(row.paidCount)
      const overdueCount = Number(row.overdueCount)
      const totalCount = paidCount + overdueCount
      return {
        clientId: row.clientId,
        clientName: row.clientName,
        revenue: money(row.revenue),
        exposure: money(row.exposure),
        reliabilityScore: totalCount ? Math.max(5, Math.min(100, Math.round(100 - (overdueCount / totalCount) * 42))) : 78,
      }
    }),
    recommendations,
  }
}

function parsePeriodDate(value: string | Date | null | undefined, field: string) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid ${field}.`)
  return date
}

export async function generateFinancialReport(
  user: SessionUser,
  input: { kind: FinancialReportKind; startsAt?: string | Date | null; endsAt?: string | Date | null; currency?: string | null }
): Promise<FinancialReport> {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)
  const startsAt = parsePeriodDate(input.startsAt, 'startsAt')
  const endsAt = parsePeriodDate(input.endsAt, 'endsAt')
  if (startsAt && endsAt && startsAt > endsAt) throw badRequest('Report start must be before report end.')

  const [ledgerRows, accounts] = await Promise.all([
    getLedgerRows(companyId, { startsAt, endsAt }),
    prisma.account.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, code: true, name: true, type: true, normalBalance: true, currency: true },
      orderBy: [{ code: 'asc' }],
    }),
  ])

  const accountById = new Map(accounts.map((account) => [account.id, account]))
  const reportTypes: Record<FinancialReportKind, string[]> = {
    'profit-and-loss': ['REVENUE', 'CONTRA_REVENUE', 'EXPENSE'],
    'balance-sheet': ['ASSET', 'CONTRA_ASSET', 'LIABILITY', 'CONTRA_LIABILITY', 'EQUITY'],
    'cash-flow': ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
    'general-ledger': ['ASSET', 'CONTRA_ASSET', 'LIABILITY', 'CONTRA_LIABILITY', 'EQUITY', 'REVENUE', 'CONTRA_REVENUE', 'EXPENSE'],
    'trial-balance': ['ASSET', 'CONTRA_ASSET', 'LIABILITY', 'CONTRA_LIABILITY', 'EQUITY', 'REVENUE', 'CONTRA_REVENUE', 'EXPENSE'],
    'tax-summary': ['ASSET', 'LIABILITY', 'EXPENSE', 'REVENUE'],
    'budget-vs-actual': ['EXPENSE', 'REVENUE'],
  }
  const allowedTypes = reportTypes[input.kind]
  const currency = normalizeCurrency(input.currency)

  const lines = ledgerRows
    .map((row) => {
      const account = accountById.get(row.accountId)
      if (!account || !allowedTypes.includes(account.type)) return null
      if (input.kind === 'tax-summary' && !/tax/i.test(`${account.code} ${account.name}`)) return null
      const debit = decimal(row._sum.debit)
      const credit = decimal(row._sum.credit)
      const balance = account.normalBalance === 'DEBIT' ? debit.minus(credit) : credit.minus(debit)
      return {
        key: account.id,
        label: `${account.code} ${account.name}`,
        accountCode: account.code,
        accountName: account.name,
        debit: money(debit),
        credit: money(credit),
        balance: money(balance),
      }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))

  const debitTotal = lines.reduce((total, line) => total.plus(line.debit), zeroDecimal())
  const creditTotal = lines.reduce((total, line) => total.plus(line.credit), zeroDecimal())
  const balanceTotal = lines.reduce((total, line) => total.plus(line.balance), zeroDecimal())

  return {
    kind: input.kind,
    generatedAt: new Date().toISOString(),
    currency,
    periodStart: startsAt?.toISOString() ?? null,
    periodEnd: endsAt?.toISOString() ?? null,
    totals: {
      debit: money(debitTotal),
      credit: money(creditTotal),
      balance: money(balanceTotal),
    },
    lines,
  }
}
