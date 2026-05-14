import { z } from 'zod'

const optionalId = z.string().trim().min(1).max(128).optional().nullable()
const moneyInput = z.union([z.string().trim().min(1), z.number()]).optional().nullable()

export const createExpenseSchema = z.object({
  vendorId: optionalId,
  categoryId: optionalId,
  projectId: optionalId,
  taskId: optionalId,
  clientId: optionalId,
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional().nullable(),
  expenseDate: z.string().trim().min(1).optional().nullable(),
  currency: z.string().trim().length(3).optional().nullable(),
  subtotal: moneyInput,
  taxTotal: moneyInput,
  total: moneyInput,
  reimbursable: z.boolean().optional(),
  receiptUrl: z.string().trim().url().optional().nullable(),
  recurrenceRule: z.unknown().optional(),
  metadata: z.unknown().optional(),
})
