import 'server-only'

import { prisma } from '@/lib/db'
import { badRequest } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import type { SessionUser } from '@/modules/shared/session'
import { assertFinanceManage, requireFinanceCompany } from '@/modules/finance/policy'
import { normalizeCurrency } from '@/modules/accounting/money'
import { createForecastSchema } from '@/modules/forecasting/forecasting.validation'
import { getFinancialOperatingSystemDashboard } from '@/modules/reporting'

function parseOptionalDate(value: string | null | undefined, field: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid ${field}.`)
  return date
}

export async function createForecast(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createForecastSchema.parse(rawInput)
  const startsAt = parseOptionalDate(input.startsAt, 'startsAt')
  const endsAt = parseOptionalDate(input.endsAt, 'endsAt')
  if (startsAt && endsAt && startsAt > endsAt) throw badRequest('Forecast start must be before end.')
  if (input.periodId) {
    const period = await prisma.financialPeriod.findFirst({ where: { id: input.periodId, companyId }, select: { id: true } })
    if (!period) throw badRequest('Selected forecast period was not found in this workspace.')
  }

  return prisma.forecast.create({
    data: {
      companyId,
      periodId: input.periodId ?? null,
      name: input.name,
      horizon: input.horizon ?? 'MONTHLY',
      currency: normalizeCurrency(input.currency),
      startsAt,
      endsAt,
      assumptions: toJsonValue(input.assumptions),
      metrics: toJsonValue(input.metrics),
    },
  })
}

function numberValue(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function money(value: number) {
  return value.toFixed(2)
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export async function generateEnterpriseForecast(user: SessionUser) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const dashboard = await getFinancialOperatingSystemDashboard(user)
  const now = new Date()
  const monthly = dashboard.trends.monthly
  const lastRevenue = monthly.map((point) => numberValue(point.revenue)).filter((value) => value > 0)
  const lastExpenses = monthly.map((point) => numberValue(point.expenses)).filter((value) => value > 0)
  const lastPayroll = monthly.map((point) => numberValue(point.payroll)).filter((value) => value > 0)
  const baseRevenue = average(lastRevenue.slice(-3)) || numberValue(dashboard.metrics.paidRevenue)
  const baseExpenses = average(lastExpenses.slice(-3)) || numberValue(dashboard.metrics.expenseExposure)
  const basePayroll = average(lastPayroll.slice(-3)) || numberValue(dashboard.metrics.payrollExposure)
  const currentCash = numberValue(dashboard.metrics.cashBalance)
  const openReceivables = numberValue(dashboard.metrics.openReceivables)
  const overdueReceivables = numberValue(dashboard.metrics.overdueReceivables)
  const collectionDrag = openReceivables ? Math.min(0.35, overdueReceivables / openReceivables) : 0
  const scenarios = [
    { id: 'optimistic', label: 'Optimistic', revenueGrowth: 0.09, costGrowth: 0.025, collectionRate: 0.88 },
    { id: 'realistic', label: 'Realistic', revenueGrowth: 0.035, costGrowth: 0.04, collectionRate: Math.max(0.52, 0.74 - collectionDrag) },
    { id: 'pessimistic', label: 'Pessimistic', revenueGrowth: -0.025, costGrowth: 0.065, collectionRate: Math.max(0.35, 0.58 - collectionDrag) },
  ]

  const projected = scenarios.map((scenario) => {
    let cash = currentCash
    const months = Array.from({ length: 12 }, (_, index) => {
      const period = addMonths(now, index)
      const revenue = baseRevenue * Math.pow(1 + scenario.revenueGrowth, index + 1)
      const expenses = baseExpenses * Math.pow(1 + scenario.costGrowth, index + 1)
      const payroll = basePayroll * Math.pow(1 + scenario.costGrowth * 0.85, index + 1)
      const collections = revenue * scenario.collectionRate + (index < 3 ? openReceivables * scenario.collectionRate / 3 : 0)
      const netCashflow = collections - expenses - payroll
      cash += netCashflow
      return {
        label: monthLabel(period),
        periodStart: period.toISOString(),
        revenue: money(revenue),
        collections: money(collections),
        expenses: money(expenses),
        payroll: money(payroll),
        netCashflow: money(netCashflow),
        endingCash: money(cash),
      }
    })
    const firstNegative = months.findIndex((month) => numberValue(month.endingCash) < 0)
    const profitability = months.reduce((sum, month) => sum + numberValue(month.revenue) - numberValue(month.expenses) - numberValue(month.payroll), 0)
    return {
      ...scenario,
      runwayMonths: firstNegative === -1 ? null : firstNegative + 1,
      projectedProfitability: money(profitability),
      confidence: scenario.id === 'realistic' ? Math.max(52, Math.min(91, 78 - Math.round(collectionDrag * 100))) : 64,
      months,
    }
  })

  const risks = [
    overdueReceivables > 0 ? `${money(overdueReceivables)} overdue receivables reduce collection confidence and can compress treasury runway.` : '',
    dashboard.metrics.payrollRevenueRatio > 55 ? `Payroll equals ${dashboard.metrics.payrollRevenueRatio}% of revenue, so hiring or overtime pressure will rapidly bend the forecast.` : '',
    dashboard.metrics.grossMarginPercent < 35 ? `Gross margin at ${dashboard.metrics.grossMarginPercent}% leaves limited room for revision loops or discounting.` : '',
    dashboard.metrics.deliveryToCashDays ? `Average delivery-to-cash latency is ${dashboard.metrics.deliveryToCashDays} days and should be shortened before growth spend increases.` : '',
  ].filter(Boolean)

  return {
    generatedAt: now.toISOString(),
    model: 'taskit-enterprise-forecast-engine-v1',
    currency: dashboard.metrics.primaryCurrency,
    assumptions: {
      baseRevenue: money(baseRevenue),
      baseExpenses: money(baseExpenses),
      basePayroll: money(basePayroll),
      openReceivables: money(openReceivables),
      overdueReceivables: money(overdueReceivables),
      currentCash: money(currentCash),
    },
    scenarios: projected,
    explanation: {
      confidence: risks.length ? 'Confidence is constrained by receivables age, margin quality, and payroll burden.' : 'Confidence is strongest because cash, margin, payroll, and collection signals are currently stable.',
      bottlenecks: risks.length ? risks : ['No major forecast bottleneck is visible from current finance records.'],
      strategicMove: projected.find((scenario) => scenario.id === 'realistic')?.runwayMonths
        ? 'Protect runway by accelerating collections and limiting discretionary spend until realistic cash stays positive for the full horizon.'
        : 'Use the realistic scenario as the operating plan and approve growth spend only when it preserves positive ending cash.',
    },
    companyId,
  }
}
