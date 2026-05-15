import 'server-only'

import { prisma } from '@/lib/db'
import type { SessionUser } from '@/modules/shared/session'
import { assertFinanceRead, requireFinanceCompany } from '@/modules/finance/policy'
import { getFinancialOperatingSystemDashboard } from '@/modules/reporting'

export async function generateCfoCopilotBrief(user: SessionUser) {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)

  const [operatingSystem, latestSnapshots, overdueInvoices, openExpenses, revisionLoad, delayedApprovals, activeProjects] = await Promise.all([
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
    prisma.deliverable.aggregate({ where: { companyId, revisionCount: { gt: 1 } }, _sum: { revisionCount: true }, _count: { id: true } }),
    prisma.deliverable.count({
      where: {
        companyId,
        dueAt: { lt: new Date() },
        OR: [{ approvalState: 'PENDING' }, { approvalState: 'CHANGES_REQUESTED' }, { status: 'CLIENT_REVIEW' }, { status: 'INTERNAL_REVIEW' }],
      },
    }),
    prisma.project.count({ where: { companyId } }),
  ])

  const profitabilitySignals = latestSnapshots.map((snapshot) => {
    const label = snapshot.project?.title ?? snapshot.client?.companyName ?? snapshot.scope
    const margin = snapshot.grossMarginPercent.toString()
    const leakage = snapshot.marginLeakage.toString()
    return `${label}: ${margin}% gross margin with ${leakage} in margin leakage`
  })

  const metrics = operatingSystem.metrics
  const strategicSignals = operatingSystem.recommendations.map((insight) => `${insight.title}: ${insight.narrative} ${insight.recommendation}`)
  const revenue = Number(metrics.paidRevenue)
  const payroll = Number(metrics.payrollExposure)
  const overdue = Number(metrics.overdueReceivables)
  const openReceivables = Number(metrics.openReceivables)
  const cash = Number(metrics.cashBalance)
  const overdueCashShare = openReceivables > 0 ? Math.round((overdue / Math.max(openReceivables, 1)) * 100) : 0
  const treasuryPressureDays = Number(metrics.monthlyBurn) > 0 ? Math.max(1, Math.round((cash / Number(metrics.monthlyBurn)) * 30)) : null
  const revisionCount = Number(revisionLoad._sum.revisionCount ?? 0)
  const revisionNarrative = revisionCount
    ? `${revisionLoad._count.id} revision-heavy deliverable(s) account for ${revisionCount} total revision loops, a direct margin-leakage signal when labor is not rebilled.`
    : 'Revision workload is not currently visible as a margin pressure signal.'

  return {
    generatedAt: new Date().toISOString(),
    model: 'taskit-autonomous-cfo-strategist-v3',
    summary: [
      `Financial health is ${metrics.financialHealthScore}; cash is ${metrics.cashBalance}, runway is ${metrics.runwayMonths === null ? 'not constrained by current burn' : `${metrics.runwayMonths} months`}, and treasury pressure ${treasuryPressureDays ? `could arrive in about ${treasuryPressureDays} days if burn and collections do not improve` : 'is currently eased by positive operating cashflow'}.`,
      `Receivables quality: ${metrics.overdueReceivables} overdue represents ${overdueCashShare}% of open receivables, so collection timing now matters as much as booked revenue.`,
      `Operating economics: ${metrics.grossMarginPercent}% gross margin and ${metrics.payrollRevenueRatio}% payroll-to-revenue ratio show ${payroll > revenue && revenue > 0 ? 'payroll is outpacing recognized revenue' : 'payroll is inside the current revenue envelope'}, while top-client concentration is ${metrics.clientConcentrationPercent}%.`,
      `Delivery-to-cash causality: ${metrics.deliveryToCashDays === null ? 'payment history is still too thin for latency confidence' : `${metrics.deliveryToCashDays} average days to cash`} across ${activeProjects} active project record(s), with ${delayedApprovals} overdue approval blocker(s).`,
      revisionNarrative,
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
