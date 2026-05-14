import 'server-only'

import { prisma } from '@/lib/db'
import type { SessionUser } from '@/modules/shared/session'
import { assertFinanceRead, requireFinanceCompany } from '@/modules/finance/policy'

export async function generateCfoCopilotBrief(user: SessionUser) {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)

  const [latestSnapshots, overdueInvoices, openExpenses] = await Promise.all([
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
    return `${label}: ${margin}% gross margin, ${leakage} margin leakage signal`
  })

  return {
    generatedAt: new Date().toISOString(),
    model: 'deterministic-cfo-copilot-v1',
    summary: [
      profitabilitySignals.length ? `Profitability signals: ${profitabilitySignals.join('; ')}.` : 'No profitability snapshots have been computed yet.',
      overdueInvoices.length ? `${overdueInvoices.length} overdue invoice(s) require collection attention.` : 'No overdue invoices detected.',
      openExpenses ? `${openExpenses} submitted expense(s) are waiting for approval.` : 'No submitted expenses are waiting for approval.',
    ],
    overdueInvoices: overdueInvoices.map((invoice) => ({
      ...invoice,
      total: invoice.total.toString(),
      dueDate: invoice.dueDate?.toISOString() ?? null,
    })),
  }
}
