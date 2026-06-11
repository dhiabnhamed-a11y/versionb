import { tenantQueryRaw } from '@/lib/tenant/tenant-raw-query';
import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export type MonthlyOperatingRow = {
  month: Date
  revenue: Prisma.Decimal | number | string | null
  invoiced: Prisma.Decimal | number | string | null
  expenses: Prisma.Decimal | number | string | null
  payroll: Prisma.Decimal | number | string | null
}

export type ClientExposureRow = {
  clientId: string | null
  clientName: string
  revenue: Prisma.Decimal | number | string | null
  exposure: Prisma.Decimal | number | string | null
  paidCount: bigint | number
  overdueCount: bigint | number
}

export type AgingRow = {
  bucket: string
  total: Prisma.Decimal | number | string | null
}

export type LedgerReportRow = {
  accountId: string
  debit: Prisma.Decimal | number | string | null
  credit: Prisma.Decimal | number | string | null
}

export function getMonthlyOperatingRows(companyId: string, startsAt: Date) {
  return tenantQueryRaw<MonthlyOperatingRow[]>`
    WITH months AS (
      SELECT generate_series(date_trunc('month', ${startsAt}::timestamp), date_trunc('month', now()), interval '1 month') AS month
    ),
    invoice_months AS (
      SELECT
        date_trunc('month', "issueDate") AS month,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS revenue,
        COALESCE(SUM(total), 0) AS invoiced
      FROM "Invoice"
      WHERE "companyId" = ${companyId}
        AND "issueDate" >= ${startsAt}
      GROUP BY 1
    ),
    expense_months AS (
      SELECT date_trunc('month', "expenseDate") AS month, COALESCE(SUM(total), 0) AS expenses
      FROM "Expense"
      WHERE "companyId" = ${companyId}
        AND "expenseDate" >= ${startsAt}
        AND status NOT IN ('REJECTED', 'VOID')
      GROUP BY 1
    ),
    payroll_months AS (
      SELECT date_trunc('month', "periodEnd") AS month, COALESCE(SUM("grossPay"), 0) AS payroll
      FROM "Payroll"
      WHERE "companyId" = ${companyId}
        AND "periodEnd" >= ${startsAt}
        AND status NOT IN ('VOID')
      GROUP BY 1
    )
    SELECT
      months.month,
      COALESCE(invoice_months.revenue, 0) AS revenue,
      COALESCE(invoice_months.invoiced, 0) AS invoiced,
      COALESCE(expense_months.expenses, 0) AS expenses,
      COALESCE(payroll_months.payroll, 0) AS payroll
    FROM months
    LEFT JOIN invoice_months ON invoice_months.month = months.month
    LEFT JOIN expense_months ON expense_months.month = months.month
    LEFT JOIN payroll_months ON payroll_months.month = months.month
    ORDER BY months.month ASC
  `
}

export function getClientExposureRows(companyId: string, startsAt: Date) {
  return tenantQueryRaw<ClientExposureRow[]>`
    SELECT
      "clientId",
      "clientName",
      COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN status IN ('sent', 'viewed', 'partially_paid', 'overdue', 'disputed', 'escalated') THEN total ELSE 0 END), 0) AS exposure,
      COUNT(*) FILTER (WHERE status = 'paid') AS "paidCount",
      COUNT(*) FILTER (WHERE status = 'overdue') AS "overdueCount"
    FROM "Invoice"
    WHERE "companyId" = ${companyId}
      AND "issueDate" >= ${startsAt}
    GROUP BY "clientId", "clientName"
    ORDER BY exposure DESC, revenue DESC
    LIMIT 8
  `
}

export function getReceivablesAgingRows(companyId: string, asOf: Date) {
  return tenantQueryRaw<AgingRow[]>`
    SELECT
      CASE
        WHEN "dueDate" IS NULL OR "dueDate" >= ${asOf} THEN 'current'
        WHEN ${asOf}::date - "dueDate"::date BETWEEN 1 AND 30 THEN 'days1To30'
        WHEN ${asOf}::date - "dueDate"::date BETWEEN 31 AND 60 THEN 'days31To60'
        WHEN ${asOf}::date - "dueDate"::date BETWEEN 61 AND 90 THEN 'days61To90'
        ELSE 'over90'
      END AS bucket,
      COALESCE(SUM(total), 0) AS total
    FROM "Invoice"
    WHERE "companyId" = ${companyId}
      AND status IN ('sent', 'viewed', 'partially_paid', 'overdue', 'disputed', 'escalated')
    GROUP BY 1
  `
}

export function getLedgerRows(companyId: string, input: { startsAt?: Date | null; endsAt?: Date | null }) {
  return prisma.ledger.groupBy({
    by: ['accountId'],
    where: {
      companyId,
      ...(input.startsAt || input.endsAt
        ? {
            postingDate: {
              ...(input.startsAt ? { gte: input.startsAt } : {}),
              ...(input.endsAt ? { lte: input.endsAt } : {}),
            },
          }
        : {}),
    },
    _sum: {
      debit: true,
      credit: true,
      balanceImpact: true,
    },
  })
}
