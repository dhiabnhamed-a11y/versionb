import { z } from 'zod'
import { FINANCIAL_ACCOUNT_TYPES, JOURNAL_SOURCE_TYPES, NORMAL_BALANCES } from '@/modules/accounting/types'

const optionalId = z.string().trim().min(1).max(128).optional().nullable()
const moneyInput = z.union([z.string().trim().min(1), z.number()]).optional().nullable()
const metadataInput = z.unknown().optional()

export const createChartOfAccountSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  currency: z.string().trim().length(3).optional().nullable(),
  isDefault: z.boolean().optional(),
  metadata: metadataInput,
})

export const createAccountSchema = z.object({
  chartId: optionalId,
  parentAccountId: optionalId,
  code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9._-]+$/),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  type: z.enum(FINANCIAL_ACCOUNT_TYPES),
  normalBalance: z.enum(NORMAL_BALANCES).optional(),
  currency: z.string().trim().length(3).optional().nullable(),
  isSystem: z.boolean().optional(),
  metadata: metadataInput,
})

export const createFinancialPeriodSchema = z.object({
  name: z.string().trim().min(2).max(120),
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().min(1),
  metadata: metadataInput,
})

export const journalLineSchema = z.object({
  accountId: z.string().trim().min(1),
  description: z.string().trim().max(1000).optional().nullable(),
  debit: moneyInput,
  credit: moneyInput,
  projectId: optionalId,
  clientId: optionalId,
  invoiceId: optionalId,
  taskId: optionalId,
  targetType: z.string().trim().max(80).optional().nullable(),
  targetId: z.string().trim().max(128).optional().nullable(),
  metadata: metadataInput,
})

export const createJournalEntrySchema = z.object({
  periodId: optionalId,
  invoiceId: optionalId,
  entryNumber: z.string().trim().min(1).max(80).optional().nullable(),
  sourceType: z.enum(JOURNAL_SOURCE_TYPES).optional(),
  sourceId: z.string().trim().max(128).optional().nullable(),
  memo: z.string().trim().max(2000).optional().nullable(),
  currency: z.string().trim().length(3).optional().nullable(),
  transactionDate: z.string().trim().min(1).optional().nullable(),
  idempotencyKey: z.string().trim().max(160).optional().nullable(),
  requiresApproval: z.boolean().optional(),
  postNow: z.boolean().optional(),
  metadata: metadataInput,
  lines: z.array(journalLineSchema).min(2),
})

export const reverseJournalEntrySchema = z.object({
  reason: z.string().trim().min(3).max(2000),
  transactionDate: z.string().trim().min(1).optional().nullable(),
  idempotencyKey: z.string().trim().max(160).optional().nullable(),
})
