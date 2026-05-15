import 'server-only'

import { prisma } from '@/lib/db'
import type { SessionUser } from '@/modules/shared/session'
import { assertFinanceRead, requireFinanceCompany } from '@/modules/finance/policy'
import { getFinancialOperatingSystemDashboard } from '@/modules/reporting'

export async function generateCfoCopilotBrief(user: SessionUser) {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)

  const [operatingSystem, latestSnapshots, overdueInvoices, openExpenses] = await Promise.all([
    getFinancialOperatingSystemDashboard(user),
    prisma.profitabilitySnapshot.findMany({
      where: { companyId },
      orderBy: { computedAt: 'desc' },
      take: 5,
      include: { project: { select: { title: true } }, client: { select: { companyName: true } } },
    }),
    prisma.invoice.findMany({
      where: { companyId, status: 'overdue' },
      orderBy: { dueDate: 'asc' },
      take: 5,
      select: { invoiceNumber: true, clientName: true, total: true, dueDate: true },
    }),
    prisma.expense.count({ where: { companyId, status: 'SUBMITTED' } }),
  ])

  const profitabilitySignals = latestSnapshots.map((snapshot) => {
    const label = snapshot.project?.title ?? snapshot.client?.companyName ?? snapshot.scope
    const margin = snapshot.grossMarginPercent.toString()
    const leakage = snapshot.marginLeakage.toString()
    return `${label}: ${margin}% gross margin with ${leakage} in margin leakage`
  })

  const metrics = operatingSystem.metrics
  const strategicSignals = operatingSystem.recommendations.map((insight) => `${insight.title}: ${insight.narrative} ${insight.recommendation}`)

  return {
    generatedAt: new Date().toISOString(),
    model: 'deterministic-cfo-copilot-v2',
    summary: [
      `Financial health is ${metrics.financialHealthScore} with ${metrics.runwayMonths === null ? 'positive operating cashflow' : `${metrics.runwayMonths} months of runway`} and ${metrics.cashBalance} in treasury balance.`,
      `Delivery-to-cash posture: ${metrics.openReceivables} open receivables, ${metrics.overdueReceivables} overdue, and ${metrics.deliveryToCashDays === null ? 'insufficient payment history' : `${metrics.deliveryToCashDays} average days to cash`}.`,
      `Operating economics: ${metrics.grossMarginPercent}% gross margin, ${metrics.payrollRevenueRatio}% payroll-to-revenue ratio, and ${metrics.clientConcentrationPercent}% top-client receivables concentration.`,
      profitabilitySignals.length ? `Profitability signals: ${profitabilitySignals.join('; ')}.` : 'Profitability snapshots have not been computed yet; ledger and project links are ready for margin intelligence.',
      strategicSignals[0] ?? (overdueInvoices.length ? `${overdueInvoices.length} overdue invoice(s) require collection attention.` : 'No overdue invoices detected.'),
      openExpenses ? `${openExpenses} submitted expense(s) are waiting for approval and should be evaluated against budget variance.` : 'No submitted expenses are waiting for approval.',
    ],
    recommendations: operatingSystem.recommendations,
    metrics,
    overdueInvoices: overdueInvoices.map((invoice) => ({
      ...invoice,
      total: invoice.total.toString(),
      dueDate: invoice.dueDate?.toISOString() ?? null,
    })),
  }
}
