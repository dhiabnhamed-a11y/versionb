import 'server-only'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export type TrialBalanceFilters = {
  startsAt?: Date | null
  endsAt?: Date | null
  departmentId?: string | null
  projectId?: string | null
  costCenterId?: string | null
  currency?: string | null
}

export function getTrialBalanceRows(companyId: string, filters: TrialBalanceFilters) {
  const where: Prisma.LedgerWhereInput = {
    companyId,
    ...(filters.currency ? { currency: filters.currency } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.projectId ? { journalLine: { projectId: filters.projectId } } : {}),
    ...(filters.costCenterId ? { costCenterId: filters.costCenterId } : {}),
    ...(filters.startsAt || filters.endsAt
      ? {
          postingDate: {
            ...(filters.startsAt ? { gte: filters.startsAt } : {}),
            ...(filters.endsAt ? { lte: filters.endsAt } : {}),
          },
        }
      : {}),
  }

  return prisma.ledger.groupBy({
    by: ['accountId', 'currency'],
    where,
    _sum: {
      debit: true,
      credit: true,
      debitMinor: true,
      creditMinor: true,
      balanceImpact: true,
      balanceImpactMinor: true,
    },
  })
}

export function listAccountsForTrialBalance(companyId: string, accountIds: string[]) {
  return prisma.account.findMany({
    where: { companyId, id: { in: accountIds }, deletedAt: null },
    select: { id: true, code: true, name: true, type: true, normalBalance: true },
  })
}
