import { z } from 'zod'

export const financialReportQuerySchema = z.object({
  kind: z.enum([
    'profit-and-loss',
    'balance-sheet',
    'cash-flow',
    'general-ledger',
    'trial-balance',
    'tax-summary',
    'budget-vs-actual',
  ]),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  currency: z.string().trim().length(3).optional(),
})
