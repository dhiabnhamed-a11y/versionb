import 'server-only'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { PaginationInput } from '@/modules/shared/pagination'

export const accountReadSelect = {
  id: true,
  companyId: true,
  chartId: true,
  parentAccountId: true,
  code: true,
  name: true,
  description: true,
  type: true,
  normalBalance: true,
  currency: true,
  status: true,
  isSystem: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AccountSelect

export const journalEntryReadSelect = {
  id: true,
  companyId: true,
  periodId: true,
  createdById: true,
  approvedById: true,
  postedById: true,
  invoiceId: true,
  entryNumber: true,
  status: true,
  sourceType: true,
  sourceId: true,
  memo: true,
  currency: true,
  accountingBasis: true,
  baseCurrency: true,
  transactionDate: true,
  totalDebit: true,
  totalCredit: true,
  totalDebitMinor: true,
  totalCreditMinor: true,
  idempotencyKey: true,
  postedAt: true,
  approvedAt: true,
  reversedAt: true,
  reversalOfEntryId: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  period: { select: { id: true, name: true, startsAt: true, endsAt: true, status: true } },
  lines: {
    select: {
      id: true,
      accountId: true,
      lineNumber: true,
      description: true,
      debit: true,
      credit: true,
      debitMinor: true,
      creditMinor: true,
      baseDebitMinor: true,
      baseCreditMinor: true,
      currency: true,
      exchangeRate: true,
      departmentId: true,
      costCenterId: true,
      projectId: true,
      clientId: true,
      invoiceId: true,
      taskId: true,
      reconciliationId: true,
      reconciledAt: true,
      reconciledById: true,
      targetType: true,
      targetId: true,
      metadata: true,
      account: { select: { id: true, code: true, name: true, type: true, normalBalance: true } },
    },
    orderBy: { lineNumber: 'asc' as const },
  },
} satisfies Prisma.JournalEntrySelect

export function listAccountsForCompany(companyId: string) {
  return prisma.account.findMany({
    where: { companyId, deletedAt: null },
    select: accountReadSelect,
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
  })
}

export function listJournalEntriesForCompany(companyId: string, pagination: PaginationInput) {
  return prisma.$transaction([
    prisma.journalEntry.findMany({
      where: { companyId },
      select: journalEntryReadSelect,
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.journalEntry.count({ where: { companyId } }),
  ])
}

export function findJournalEntryForCompany(companyId: string, id: string) {
  return prisma.journalEntry.findFirst({
    where: { companyId, id },
    select: journalEntryReadSelect,
  })
}

export { prisma as accountingPrisma }
