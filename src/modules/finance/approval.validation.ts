import { z } from 'zod'

const optionalId = z.string().trim().min(1).max(128).optional().nullable()

export const FINANCE_APPROVAL_ENTITY_TYPES = ['expense', 'payroll', 'treasury_transaction', 'invoice', 'journal_entry'] as const

export const createFinanceApprovalFlowSchema = z.object({
  entityType: z.enum(FINANCE_APPROVAL_ENTITY_TYPES),
  entityId: z.string().trim().min(1).max(128),
  flowType: z.string().trim().min(2).max(80),
  requiredRole: z.string().trim().max(80).optional().nullable(),
  summary: z.string().trim().max(2000).optional().nullable(),
  aiSummary: z.unknown().optional(),
  escalatesAt: z.string().trim().min(1).optional().nullable(),
  metadata: z.unknown().optional(),
  steps: z
    .array(
      z.object({
        assignedToId: optionalId,
        dueAt: z.string().trim().min(1).optional().nullable(),
        metadata: z.unknown().optional(),
      })
    )
    .min(1)
    .max(12),
})

export const decideFinanceApprovalStepSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(2000).optional().nullable(),
  metadata: z.unknown().optional(),
})

