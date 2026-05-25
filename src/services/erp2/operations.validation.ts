import { z } from 'zod'

export const erpModuleNameSchema = z.enum([
  'general-ledger',
  'accounts-receivable',
  'accounts-payable',
  'budgets',
  'procurement',
  'inventory',
  'hr',
  'leave',
  'reports',
  'settings',
  'roles',
])

const optionalText = z.string().trim().optional().or(z.literal(''))
const requiredText = z.string().trim().min(1)
const moneyAmount = z.coerce.number().finite().nonnegative()
const positiveMoneyAmount = z.coerce.number().finite().positive()
const positiveInteger = z.coerce.number().int().positive()
const nonnegativeInteger = z.coerce.number().int().nonnegative()
const dateString = z.string().trim().min(1)

export const erpGenericModuleCreateSchema = z
  .object({
    kind: z.string().trim().optional(),
  })
  .passthrough()

export const erpGenericModulePatchSchema = z
  .object({
    id: z.string().trim().min(1),
    action: z.string().trim().min(1),
  })
  .passthrough()

export const createErpJournalEntrySchema = z.object({
  date: dateString,
  description: requiredText,
  reference: optionalText,
  debitAccountId: requiredText,
  creditAccountId: requiredText,
  amount: positiveMoneyAmount,
  currency: z.string().trim().min(3).max(3).optional(),
  postNow: z.coerce.boolean().default(true),
})

export const createErpReceivableSchema = z.object({
  clientId: optionalText,
  clientName: requiredText,
  clientEmail: optionalText,
  invoiceRef: optionalText,
  amount: positiveMoneyAmount,
  currency: z.string().trim().min(3).max(3).optional(),
  dueDate: dateString,
})

export const createErpPayableSchema = z.object({
  vendorId: optionalText,
  vendorName: requiredText,
  vendorEmail: optionalText,
  vendorPhone: optionalText,
  billNumber: requiredText,
  amount: positiveMoneyAmount,
  currency: z.string().trim().min(3).max(3).optional(),
  issueDate: dateString,
  dueDate: dateString,
  description: optionalText,
})

export const createErpBudgetSchema = z.object({
  name: requiredText,
  accountCode: requiredText,
  accountName: optionalText,
  monthlyAmount: positiveMoneyAmount,
  currency: z.string().trim().min(3).max(3).optional(),
  startDate: dateString,
  endDate: dateString,
  status: z.enum(['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED']).optional(),
})

export const createErpPurchaseOrderSchema = z.object({
  vendorId: optionalText,
  vendorName: requiredText,
  description: requiredText,
  quantity: positiveInteger,
  unitPrice: positiveMoneyAmount,
  unit: optionalText,
  expectedDate: optionalText,
  notes: optionalText,
  currency: z.string().trim().min(3).max(3).optional(),
})

export const createErpInventoryItemSchema = z.object({
  sku: requiredText,
  name: requiredText,
  category: optionalText,
  unit: z.string().trim().default('piece'),
  currentStock: nonnegativeInteger.default(0),
  reorderPoint: nonnegativeInteger.default(0),
  reorderQty: nonnegativeInteger.default(0),
  unitCost: moneyAmount.default(0),
  currency: z.string().trim().min(3).max(3).optional(),
})

export const createErpEmployeeSchema = z.object({
  employeeNumber: requiredText,
  firstName: requiredText,
  lastName: requiredText,
  email: z.string().trim().email(),
  phone: optionalText,
  jobTitle: requiredText,
  departmentId: optionalText,
  startDate: dateString,
  contractType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).default('FULL_TIME'),
  baseSalary: positiveMoneyAmount,
  currency: z.string().trim().min(3).max(3).optional(),
  payFrequency: z.enum(['MONTHLY', 'BIWEEKLY', 'WEEKLY']).default('MONTHLY'),
})

export const createErpLeaveRequestSchema = z.object({
  employeeId: requiredText,
  type: z.enum(['ANNUAL', 'SICK', 'UNPAID', 'MATERNITY', 'PATERNITY', 'OTHER']),
  startDate: dateString,
  endDate: dateString,
  reason: optionalText,
})

export const updateErpSettingsSchema = z.object({
  defaultCurrency: z.string().trim().min(3).max(3),
  accountingBasis: z.enum(['ACCRUAL', 'CASH']),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
  taxName: requiredText,
  taxRate: z.coerce.number().finite().min(0).max(100),
})

export const createErpTaxRateSchema = z.object({
  name: requiredText,
  rate: z.coerce.number().finite().min(0).max(100),
  appliesTo: z.enum(['INCOME', 'EXPENSE', 'BOTH']).default('BOTH'),
})

export type ErpModuleName = z.infer<typeof erpModuleNameSchema>
