import { z } from 'zod'

const optionalId = z.string().trim().min(1).max(128).optional().nullable()
const moneyInput = z.union([z.string().trim().min(1), z.number()]).optional().nullable()

export const payrollItemInputSchema = z.object({
  employeeId: z.string().trim().min(1),
  projectId: optionalId,
  taskId: optionalId,
  itemType: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional().nullable(),
  hours: moneyInput,
  rate: moneyInput,
  amount: moneyInput,
  taxable: z.boolean().optional(),
  metadata: z.unknown().optional(),
})

export const createPayrollSchema = z.object({
  periodStart: z.string().trim().min(1),
  periodEnd: z.string().trim().min(1),
  currency: z.string().trim().length(3).optional().nullable(),
  metadata: z.unknown().optional(),
  items: z.array(payrollItemInputSchema).min(1),
})

export const postPayrollSchema = z.object({
  wageExpenseAccountId: z.string().trim().min(1),
  payrollLiabilityAccountId: z.string().trim().min(1),
  taxLiabilityAccountId: optionalId,
})
