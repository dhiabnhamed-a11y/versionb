import type { Prisma } from '@prisma/client'

export const FINANCIAL_ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  'CONTRA_ASSET',
  'CONTRA_LIABILITY',
  'CONTRA_REVENUE',
] as const

export const NORMAL_BALANCES = ['DEBIT', 'CREDIT'] as const
export const JOURNAL_SOURCE_TYPES = ['MANUAL', 'INVOICE', 'PAYMENT', 'PAYROLL', 'EXPENSE', 'TREASURY', 'TRANSFER', 'ADJUSTMENT', 'REVERSAL', 'AI'] as const

export type FinancialAccountTypeValue = (typeof FINANCIAL_ACCOUNT_TYPES)[number]
export type NormalBalanceValue = (typeof NORMAL_BALANCES)[number]
export type JournalSourceTypeValue = (typeof JOURNAL_SOURCE_TYPES)[number]

export type JournalLineCommand = {
  accountId: string
  description?: string | null
  debit?: Prisma.Decimal | string | number | null
  credit?: Prisma.Decimal | string | number | null
  departmentId?: string | null
  costCenterId?: string | null
  projectId?: string | null
  clientId?: string | null
  invoiceId?: string | null
  taskId?: string | null
  targetType?: string | null
  targetId?: string | null
  metadata?: unknown
}

export type JournalEntryCommand = {
  companyId: string
  actorId?: string | null
  periodId?: string | null
  invoiceId?: string | null
  entryNumber?: string | null
  sourceType?: JournalSourceTypeValue
  sourceId?: string | null
  memo?: string | null
  currency?: string | null
  accountingBasis?: 'ACCRUAL' | 'CASH'
  baseCurrency?: string | null
  transactionDate?: Date | string | null
  idempotencyKey?: string | null
  requiresApproval?: boolean
  postNow?: boolean
  reversalOfEntryId?: string | null
  metadata?: unknown
  lines: JournalLineCommand[]
}
