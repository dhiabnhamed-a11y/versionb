import { z } from 'zod'

export const aiRiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
export const aiRunStatusSchema = z.enum([
  'PLANNED',
  'PREVIEWED',
  'PENDING_CONFIRMATION',
  'PENDING_APPROVAL',
  'QUEUED',
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
])
export const aiExecutionPhaseSchema = z.enum(['PLAN', 'PREVIEW', 'APPROVAL', 'CONFIRM', 'QUEUE', 'EXECUTE', 'COMPENSATE'])
export const aiApprovalStatusSchema = z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'ESCALATED', 'CANCELLED'])

export const aiActorSchema = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1),
  role: z.string().min(1),
  locale: z.enum(['en', 'fr', 'ar']).default('en'),
})

export const aiPlanRequestSchema = z.object({
  goal: z.string().trim().min(1).max(4000),
  actor: aiActorSchema,
  conversationId: z.string().min(8).max(100).nullable().optional(),
  dryRun: z.boolean().default(true),
  confirmationToken: z.string().min(24).max(180).nullable().optional(),
  idempotencyKey: z.string().min(8).max(180).nullable().optional(),
})

export const aiPlanStepSchema = z.object({
  sequence: z.number().int().min(1),
  name: z.string().min(1).max(140),
  toolName: z.string().min(1),
  actionKind: z.string().min(1),
  riskLevel: aiRiskLevelSchema,
  requiresConfirmation: z.boolean(),
  requiresApproval: z.boolean(),
  permissions: z.array(z.string()).default([]),
  rollbackStrategy: z.string().min(1),
})

export const aiExecutionPlanSchema = z.object({
  goal: z.string().min(1),
  riskLevel: aiRiskLevelSchema,
  estimatedCostUsd: z.number().nonnegative(),
  requiresApproval: z.boolean(),
  canExecuteImmediately: z.boolean(),
  steps: z.array(aiPlanStepSchema),
  warnings: z.array(z.string()).default([]),
})

export type AiRiskLevel = z.infer<typeof aiRiskLevelSchema>
export type AiRunStatus = z.infer<typeof aiRunStatusSchema>
export type AiExecutionPhase = z.infer<typeof aiExecutionPhaseSchema>
export type AiApprovalStatus = z.infer<typeof aiApprovalStatusSchema>
export type AiActor = z.infer<typeof aiActorSchema>
export type AiPlanRequest = z.infer<typeof aiPlanRequestSchema>
export type AiPlanStepDto = z.infer<typeof aiPlanStepSchema>
export type AiExecutionPlanDto = z.infer<typeof aiExecutionPlanSchema>
