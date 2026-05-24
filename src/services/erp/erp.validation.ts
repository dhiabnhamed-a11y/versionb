import { z } from 'zod'
import { createJournalEntrySchema, reverseJournalEntrySchema } from '@/modules/accounting/accounting.validation'

const optionalDate = z.string().trim().min(1).optional().nullable()
const optionalId = z.string().trim().min(1).max(128).optional().nullable()

export const erpJournalEntrySchema = createJournalEntrySchema
export const erpReverseJournalEntrySchema = reverseJournalEntrySchema

export const erpTrialBalanceQuerySchema = z.object({
  startsAt: optionalDate,
  endsAt: optionalDate,
  departmentId: optionalId,
  projectId: optionalId,
  costCenterId: optionalId,
  currency: z.string().trim().length(3).optional().nullable(),
})

export const erpCreatePeriodSchema = z.object({
  name: z.string().trim().min(2).max(120),
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().min(1),
  metadata: z.unknown().optional(),
})

export const erpLockPeriodSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
})

export const erpSeedStandardChartSchema = z.object({
  baseCurrency: z.string().trim().length(3).optional().nullable(),
})
