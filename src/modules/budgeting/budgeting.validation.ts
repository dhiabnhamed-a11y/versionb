import { z } from 'zod'

const optionalId = z.string().trim().min(1).max(128).optional().nullable()
const moneyInput = z.union([z.string().trim().min(1), z.number()])

export const createBudgetSchema = z.object({
  periodId: optionalId,
  projectId: optionalId,
  name: z.string().trim().min(2).max(160),
  currency: z.string().trim().length(3).optional().nullable(),
  startsAt: z.string().trim().min(1).optional().nullable(),
  endsAt: z.string().trim().min(1).optional().nullable(),
  metadata: z.unknown().optional(),
  lines: z.array(
    z.object({
      accountId: optionalId,
      projectId: optionalId,
      department: z.string().trim().max(120).optional().nullable(),
      description: z.string().trim().max(1000).optional().nullable(),
      amount: moneyInput,
      metadata: z.unknown().optional(),
    })
  ).min(1),
})
