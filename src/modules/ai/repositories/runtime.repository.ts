import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { toJsonValue } from '@/modules/shared/json'
import type { AiActor, AiExecutionPlanDto } from '@/modules/ai/dto/runtime.dto'

function json(value: unknown) {
  return toJsonValue(value)
}

export async function createPlannedAiRun(input: {
  actor: AiActor
  goal: string
  plan: AiExecutionPlanDto
  conversationId?: string | null
  idempotencyKey?: string | null
}) {
  return prisma.aiRun.create({
    data: {
      companyId: input.actor.companyId,
      userId: input.actor.id,
      conversationId: input.conversationId ?? null,
      trigger: 'operational_runtime',
      status: input.plan.steps.length ? 'PLANNED' : 'FAILED',
      phase: 'PLAN',
      input: json({ goal: input.goal, locale: input.actor.locale }),
      plan: json(input.plan),
      promptVersion: 'operational-ai-platform-v1',
      estimatedCostUsd: input.plan.estimatedCostUsd,
      idempotencyKey: input.idempotencyKey ?? undefined,
    },
  })
}

export async function createAiRunSteps(input: {
  aiRunId: string
  companyId: string
  plan: AiExecutionPlanDto
}) {
  if (!input.plan.steps.length) return []

  return prisma.$transaction(
    input.plan.steps.map((step) =>
      prisma.aiStep.create({
        data: {
          aiRunId: input.aiRunId,
          companyId: input.companyId,
          sequence: step.sequence,
          name: step.name,
          status: step.requiresApproval ? 'PENDING_APPROVAL' : 'PLANNED',
          phase: step.requiresApproval ? 'APPROVAL' : 'PLAN',
          toolName: step.toolName,
          actionKind: step.actionKind,
          riskLevel: step.riskLevel,
          permissionState: step.requiresApproval ? 'NEEDS_APPROVAL' : 'ALLOWED',
          approvalRequired: step.requiresApproval,
          maxRetries: step.riskLevel === 'CRITICAL' ? 1 : 3,
          rollback: json({ strategy: step.rollbackStrategy }),
          executionGraph: json({ sequence: step.sequence, dependsOn: step.sequence === 1 ? [] : [step.sequence - 1] }),
        },
      })
    )
  )
}

export async function recordAiDecision(input: {
  aiRunId: string
  aiStepId?: string | null
  companyId: string
  actorId?: string | null
  decisionType: string
  status?: string
  rationale: string
  inputs?: Prisma.InputJsonValue
  outputs?: Prisma.InputJsonValue
  policySnapshot?: Prisma.InputJsonValue
  riskScore?: number
}) {
  return prisma.aiDecision.create({
    data: {
      aiRunId: input.aiRunId,
      aiStepId: input.aiStepId ?? null,
      companyId: input.companyId,
      actorId: input.actorId ?? null,
      decisionType: input.decisionType,
      status: input.status ?? 'ACCEPTED',
      rationale: input.rationale,
      inputs: input.inputs,
      outputs: input.outputs,
      policySnapshot: input.policySnapshot,
      riskScore: input.riskScore ?? 0,
    },
  })
}

export async function recordAiObservation(input: {
  aiRunId: string
  aiStepId?: string | null
  companyId: string
  actorId?: string | null
  type: string
  severity?: string
  message: string
  metadata?: unknown
}) {
  return prisma.aiObservation.create({
    data: {
      aiRunId: input.aiRunId,
      aiStepId: input.aiStepId ?? null,
      companyId: input.companyId,
      actorId: input.actorId ?? null,
      type: input.type,
      severity: input.severity ?? 'INFO',
      message: input.message,
      metadata: json(input.metadata),
    },
  })
}

export async function createAiToolExecutionRecord(input: {
  aiRunId: string
  aiStepId?: string | null
  aiActionRunId?: string | null
  companyId: string
  actorId?: string | null
  toolName: string
  actionKind: string
  riskLevel: string
  requiresConfirmation: boolean
  dryRun: boolean
  input?: unknown
  audit?: unknown
  rollback?: unknown
  idempotencyKey?: string | null
}) {
  return prisma.aiToolExecution.create({
    data: {
      aiRunId: input.aiRunId,
      aiStepId: input.aiStepId ?? null,
      aiActionRunId: input.aiActionRunId ?? null,
      companyId: input.companyId,
      actorId: input.actorId ?? null,
      toolName: input.toolName,
      actionKind: input.actionKind,
      status: input.dryRun ? 'DRY_RUN' : 'QUEUED',
      dryRun: input.dryRun,
      riskLevel: input.riskLevel,
      requiresConfirmation: input.requiresConfirmation,
      input: json(input.input),
      audit: json(input.audit),
      rollback: json(input.rollback),
      idempotencyKey: input.idempotencyKey ?? undefined,
    },
  })
}
