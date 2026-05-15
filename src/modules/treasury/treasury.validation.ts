import { z } from 'zod'

const optionalId = z.string().trim().min(1).max(128).optional().nullable()
const moneyInput = z.union([z.string().trim().min(1), z.number()]).optional().nullable()

export const createTreasuryAccountSchema = z.object({
  ledgerAccountId: optionalId,
  name: z.string().trim().min(2).max(160),
  type: z.enum(['BANK', 'CASH', 'WALLET', 'CREDIT_CARD', 'PAYMENT_PROCESSOR']),
  institutionName: z.string().trim().max(160).optional().nullable(),
  maskedNumber: z.string().trim().max(40).optional().nullable(),
  currency: z.string().trim().length(3).optional().nullable(),
  openingBalance: moneyInput,
  metadata: z.unknown().optional(),
})

export const createTreasuryTransactionSchema = z.object({
  fromAccountId: optionalId,
  toAccountId: optionalId,
  invoiceId: optionalId,
  direction: z.enum(['INFLOW', 'OUTFLOW', 'TRANSFER']).optional(),
  paymentMethod: z.string().trim().max(80).optional().nullable(),
  amount: moneyInput,
  currency: z.string().trim().length(3).optional().nullable(),
  scheduledFor: z.string().trim().min(1).optional().nullable(),
  executeNow: z.boolean().optional(),
  externalRef: z.string().trim().max(160).optional().nullable(),
  memo: z.string().trim().max(1000).optional().nullable(),
  metadata: z.unknown().optional(),
})
