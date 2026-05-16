import 'server-only'

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { toJsonValue } from '@/modules/shared/json'
import type { AiToolDefinition, AiToolRiskLevel } from '@/modules/ai/tools/types'

const CONFIRMATION_TTL_MINUTES = 10
const TOKEN_BYTES = 32

export type AiActionPreviewPayload = {
  summary: string
  changes: string[]
  warnings?: string[]
  targetType?: string
  targetId?: string
  targetLabel?: string
  diff?: Prisma.JsonObject
  rollback?: Prisma.JsonObject
  metadata?: Prisma.JsonObject
}

export type AiActionPreviewCard = {
  aiRunId: string
  actionRunId: string
  toolName: string
  actionKind: string
  riskLevel: AiToolRiskLevel
  confirmationToken: string
  confirmationExpiresAt: string
  summary: string
  changes: string[]
  warnings: string[]
  targetType?: string
  targetId?: string
  targetLabel?: string
  dryRun: true
  confirmLabel: string
}

export type PendingAiAction = {
  id: string
  aiRunId: string
  companyId: string
  actorId: string | null
  toolName: string
  actionKind: string
  riskLevel: string
  input: Prisma.JsonValue | null
}

export type ConfirmationLookup =
  | { ok: true; action: PendingAiAction }
  | { ok: false; reason: 'missing' | 'expired' | 'used' | 'forbidden' }

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date)
  next.setMinutes(next.getMinutes() + minutes)
  return next
}

function createConfirmationToken() {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

function hashConfirmationToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function receiptPayload(receiptId: string, extra: Record<string, unknown> = {}) {
  return {
    receiptId,
    generatedAt: new Date().toISOString(),
    ...extra,
  }
}

function jsonObject(value: Record<string, unknown>): Prisma.JsonObject {
  return toJsonValue(value) as Prisma.JsonObject
}

export async function createAiActionPreview(input: {
  companyId: string
  actorId: string
  conversationId?: string | null
  tool: AiToolDefinition
  actionKind: string
  rawMessage: string
  canonicalMessage: string
  preview: AiActionPreviewPayload
  idempotencyKey?: string | null
}) {
  const now = new Date()
  const confirmationToken = createConfirmationToken()
  const confirmationExpiresAt = addMinutes(now, CONFIRMATION_TTL_MINUTES)
  const confirmationTokenHash = hashConfirmationToken(confirmationToken)
  const aiInput = {
    rawMessage: input.rawMessage.slice(0, 4000),
    canonicalMessage: input.canonicalMessage.slice(0, 4000),
    toolName: input.tool.name,
    actionKind: input.actionKind,
  }
  const rollback = input.preview.rollback ?? {
    strategy: input.tool.rollback.strategy,
    notes: input.tool.rollback.notes,
    targetType: input.preview.targetType ?? null,
    targetId: input.preview.targetId ?? null,
    targetLabel: input.preview.targetLabel ?? null,
  }
  const diff = input.preview.diff ?? {
    dryRun: true,
    changes: input.preview.changes,
    warnings: input.preview.warnings ?? [],
  }

  const created = await prisma.$transaction(async (tx) => {
    const aiRun = await tx.aiRun.create({
      data: {
        companyId: input.companyId,
        userId: input.actorId,
        conversationId: input.conversationId ?? null,
        trigger: 'chat',
        status: 'PENDING_CONFIRMATION',
        phase: 'PREVIEW',
        input: toJsonValue(aiInput),
        plan: toJsonValue({
          pipeline: ['PLAN', 'PREVIEW', 'CONFIRM', 'EXECUTE'],
          toolName: input.tool.name,
          actionKind: input.actionKind,
          requiresConfirmation: input.tool.requiresConfirmation,
          supportsDryRun: input.tool.supportsDryRun,
        }),
        promptVersion: 'ai-governance-v1',
        idempotencyKey: input.idempotencyKey ?? undefined,
      },
    })

    const actionRun = await tx.aiActionRun.create({
      data: {
        aiRunId: aiRun.id,
        companyId: input.companyId,
        actorId: input.actorId,
        toolName: input.tool.name,
        actionKind: input.actionKind,
        status: 'PENDING_CONFIRMATION',
        phase: 'PREVIEW',
        riskLevel: input.tool.riskLevel,
        requiresConfirmation: input.tool.requiresConfirmation,
        confirmationTokenHash,
        confirmationExpiresAt,
        idempotencyKey: input.idempotencyKey ?? undefined,
        targetType: input.preview.targetType ?? null,
        targetId: input.preview.targetId ?? null,
        preview: toJsonValue({
          summary: input.preview.summary,
          changes: input.preview.changes,
          warnings: input.preview.warnings ?? [],
          targetLabel: input.preview.targetLabel ?? null,
          metadata: input.preview.metadata ?? {},
        }),
        diff: toJsonValue(diff),
        rollback: toJsonValue(rollback),
        audit: toJsonValue({
          category: input.tool.audit.category,
          event: input.tool.audit.event,
          dryRun: true,
          actorId: input.actorId,
          companyId: input.companyId,
        }),
        input: toJsonValue(aiInput),
      },
    })

    const aiStep = await tx.aiStep.create({
      data: {
        aiRunId: aiRun.id,
        companyId: input.companyId,
        sequence: 1,
        name: input.tool.displayName,
        status: 'PENDING_APPROVAL',
        phase: 'PREVIEW',
        toolName: input.tool.name,
        actionKind: input.actionKind,
        riskLevel: input.tool.riskLevel,
        permissionState: 'NEEDS_APPROVAL',
        input: toJsonValue(aiInput),
        executionGraph: toJsonValue({ sequence: 1, dependsOn: [], mode: input.tool.execution?.mode ?? 'hybrid' }),
        rollback: toJsonValue(rollback),
        audit: toJsonValue({
          category: input.tool.audit.category,
          event: input.tool.audit.event,
          dryRun: true,
          actorId: input.actorId,
          companyId: input.companyId,
        }),
        approvalRequired: input.tool.requiresConfirmation,
        maxRetries: input.tool.execution?.maxAttempts ?? (input.tool.riskLevel === 'CRITICAL' ? 1 : 3),
      },
    })

    await tx.aiToolExecution.create({
      data: {
        aiRunId: aiRun.id,
        aiStepId: aiStep.id,
        aiActionRunId: actionRun.id,
        companyId: input.companyId,
        actorId: input.actorId,
        toolName: input.tool.name,
        actionKind: input.actionKind,
        status: 'DRY_RUN',
        dryRun: true,
        riskLevel: input.tool.riskLevel,
        requiresConfirmation: input.tool.requiresConfirmation,
        idempotencyKey: input.idempotencyKey ?? undefined,
        input: toJsonValue(aiInput),
        audit: toJsonValue({
          category: input.tool.audit.category,
          event: input.tool.audit.event,
          dryRun: true,
        }),
        rollback: toJsonValue(rollback),
        output: toJsonValue({
          summary: input.preview.summary,
          changes: input.preview.changes,
          warnings: input.preview.warnings ?? [],
        }),
      },
    })

    await tx.aiDecision.create({
      data: {
        aiRunId: aiRun.id,
        aiStepId: aiStep.id,
        companyId: input.companyId,
        actorId: input.actorId,
        decisionType: 'TOOL_SELECTION',
        status: 'ACCEPTED',
        rationale: `Selected governed tool ${input.tool.name} for action ${input.actionKind}.`,
        inputs: toJsonValue(aiInput),
        outputs: toJsonValue({ toolName: input.tool.name, actionKind: input.actionKind }),
        policySnapshot: toJsonValue({
          riskLevel: input.tool.riskLevel,
          permissions: input.tool.permissions,
          requiresConfirmation: input.tool.requiresConfirmation,
          supportsDryRun: input.tool.supportsDryRun,
          rollbackStrategy: input.tool.rollback.strategy,
        }),
        riskScore: input.tool.riskLevel === 'CRITICAL' ? 95 : input.tool.riskLevel === 'HIGH' ? 70 : input.tool.riskLevel === 'MEDIUM' ? 35 : 10,
      },
    })

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        actorId: input.actorId,
        action: 'ai.action.preview_created',
        entityType: 'ai_action_run',
        entityId: actionRun.id,
        after: toJsonValue({
          toolName: input.tool.name,
          actionKind: input.actionKind,
          riskLevel: input.tool.riskLevel,
          targetType: input.preview.targetType ?? null,
          targetId: input.preview.targetId ?? null,
          confirmationExpiresAt: confirmationExpiresAt.toISOString(),
        }),
        metadata: toJsonValue({
          aiRunId: aiRun.id,
          dryRun: true,
          pipeline: 'PLAN_PREVIEW_CONFIRM_EXECUTE',
        }),
      },
    })

    return { aiRun, actionRun }
  })

  return {
    aiRun: created.aiRun,
    actionRun: created.actionRun,
    card: {
      aiRunId: created.aiRun.id,
      actionRunId: created.actionRun.id,
      toolName: input.tool.name,
      actionKind: input.actionKind,
      riskLevel: input.tool.riskLevel,
      confirmationToken,
      confirmationExpiresAt: confirmationExpiresAt.toISOString(),
      summary: input.preview.summary,
      changes: input.preview.changes,
      warnings: input.preview.warnings ?? [],
      targetType: input.preview.targetType,
      targetId: input.preview.targetId,
      targetLabel: input.preview.targetLabel,
      dryRun: true,
      confirmLabel: `Confirm ${input.tool.displayName}`,
    } satisfies AiActionPreviewCard,
  }
}

export async function loadAiActionForConfirmation(input: {
  confirmationToken: string
  companyId: string
  actorId: string
}): Promise<ConfirmationLookup> {
  const token = input.confirmationToken.trim()
  if (!token || token.length < 24) return { ok: false, reason: 'missing' }

  const confirmationTokenHash = hashConfirmationToken(token)
  const action = await prisma.aiActionRun.findUnique({
    where: { confirmationTokenHash },
    select: {
      id: true,
      aiRunId: true,
      companyId: true,
      actorId: true,
      toolName: true,
      actionKind: true,
      riskLevel: true,
      status: true,
      confirmationExpiresAt: true,
      input: true,
    },
  })

  if (!action) return { ok: false, reason: 'missing' }
  if (action.companyId !== input.companyId || action.actorId !== input.actorId) return { ok: false, reason: 'forbidden' }
  if (action.status !== 'PENDING_CONFIRMATION') return { ok: false, reason: 'used' }
  if (!action.confirmationExpiresAt || action.confirmationExpiresAt <= new Date()) {
    await prisma.aiActionRun.update({
      where: { id: action.id },
      data: { status: 'EXPIRED', phase: 'CONFIRM', completedAt: new Date(), error: 'Confirmation token expired.' },
    })
    await prisma.aiRun.update({
      where: { id: action.aiRunId },
      data: { status: 'EXPIRED', phase: 'CONFIRM', completedAt: new Date(), error: 'Confirmation token expired.' },
    })
    return { ok: false, reason: 'expired' }
  }

  return {
    ok: true,
    action: {
      id: action.id,
      aiRunId: action.aiRunId,
      companyId: action.companyId,
      actorId: action.actorId,
      toolName: action.toolName,
      actionKind: action.actionKind,
      riskLevel: action.riskLevel,
      input: action.input,
    },
  }
}

export async function markAiActionExecuting(input: {
  actionRunId: string
  aiRunId: string
  companyId: string
  actorId: string
}) {
  const now = new Date()
  const receiptId = randomUUID()
  const receipt = receiptPayload(receiptId, {
    status: 'EXECUTING',
    confirmedBy: input.actorId,
    confirmedAt: now.toISOString(),
  })

  const update = await prisma.aiActionRun.updateMany({
    where: {
      id: input.actionRunId,
      companyId: input.companyId,
      actorId: input.actorId,
      status: 'PENDING_CONFIRMATION',
    },
    data: {
      status: 'EXECUTING',
      phase: 'EXECUTE',
      confirmationUsedAt: now,
      startedAt: now,
      attempts: { increment: 1 },
      receipt: toJsonValue(receipt),
    },
  })

  if (update.count !== 1) return null

  await prisma.aiRun.update({
    where: { id: input.aiRunId },
    data: { status: 'EXECUTING', phase: 'EXECUTE', startedAt: now },
  })

  await prisma.$transaction([
    prisma.aiStep.updateMany({
      where: { aiRunId: input.aiRunId, companyId: input.companyId, sequence: 1 },
      data: { status: 'EXECUTING', phase: 'EXECUTE', startedAt: now },
    }),
    prisma.aiToolExecution.updateMany({
      where: { aiActionRunId: input.actionRunId, companyId: input.companyId },
      data: { status: 'EXECUTING', dryRun: false, startedAt: now, attempts: { increment: 1 } },
    }),
  ])

  await prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId,
      action: 'ai.action.confirmed',
      entityType: 'ai_action_run',
      entityId: input.actionRunId,
      after: toJsonValue(receipt),
      metadata: toJsonValue({ aiRunId: input.aiRunId }),
    },
  })

  return receipt
}

export async function markAiActionCompleted(input: {
  actionRunId: string
  aiRunId: string
  companyId: string
  actorId: string
  result: unknown
  receipt: Record<string, unknown>
}) {
  const now = new Date()
  const receipt = receiptPayload(String(input.receipt.receiptId ?? randomUUID()), {
    ...input.receipt,
    status: 'COMPLETED',
    completedAt: now.toISOString(),
  })

  await prisma.$transaction([
    prisma.aiActionRun.update({
      where: { id: input.actionRunId },
      data: {
        status: 'COMPLETED',
        phase: 'EXECUTE',
        completedAt: now,
        result: toJsonValue(input.result),
        receipt: toJsonValue(receipt),
      },
    }),
    prisma.aiRun.update({
      where: { id: input.aiRunId },
      data: {
        status: 'COMPLETED',
        phase: 'EXECUTE',
        completedAt: now,
        result: toJsonValue(input.result),
      },
    }),
    prisma.aiStep.updateMany({
      where: { aiRunId: input.aiRunId, companyId: input.companyId, sequence: 1 },
      data: {
        status: 'COMPLETED',
        phase: 'EXECUTE',
        completedAt: now,
        output: toJsonValue(input.result),
      },
    }),
    prisma.aiToolExecution.updateMany({
      where: { aiActionRunId: input.actionRunId, companyId: input.companyId },
      data: {
        status: 'COMPLETED',
        dryRun: false,
        completedAt: now,
        output: toJsonValue(input.result),
        receipt: toJsonValue(receipt),
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        actorId: input.actorId,
        action: 'ai.action.completed',
        entityType: 'ai_action_run',
        entityId: input.actionRunId,
        after: toJsonValue(receipt),
        metadata: toJsonValue({ aiRunId: input.aiRunId }),
      },
    }),
  ])

  return receipt
}

export async function markAiActionFailed(input: {
  actionRunId: string
  aiRunId: string
  companyId: string
  actorId: string
  error: unknown
  receipt?: Record<string, unknown> | null
}) {
  const now = new Date()
  const message = input.error instanceof Error ? input.error.message : 'Unknown AI action execution error'
  const receipt = receiptPayload(String(input.receipt?.receiptId ?? randomUUID()), {
    ...(input.receipt ?? {}),
    status: 'FAILED',
    failedAt: now.toISOString(),
  })

  await prisma.$transaction([
    prisma.aiActionRun.update({
      where: { id: input.actionRunId },
      data: {
        status: 'FAILED',
        phase: 'EXECUTE',
        completedAt: now,
        error: message,
        receipt: toJsonValue(receipt),
      },
    }),
    prisma.aiRun.update({
      where: { id: input.aiRunId },
      data: {
        status: 'FAILED',
        phase: 'EXECUTE',
        completedAt: now,
        error: message,
      },
    }),
    prisma.aiStep.updateMany({
      where: { aiRunId: input.aiRunId, companyId: input.companyId, sequence: 1 },
      data: {
        status: 'FAILED',
        phase: 'EXECUTE',
        completedAt: now,
        error: message,
      },
    }),
    prisma.aiToolExecution.updateMany({
      where: { aiActionRunId: input.actionRunId, companyId: input.companyId },
      data: {
        status: 'FAILED',
        dryRun: false,
        completedAt: now,
        error: message,
        receipt: toJsonValue(receipt),
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        actorId: input.actorId,
        action: 'ai.action.failed',
        entityType: 'ai_action_run',
        entityId: input.actionRunId,
        after: toJsonValue(receipt),
        metadata: toJsonValue({ aiRunId: input.aiRunId, error: message }),
      },
    }),
  ])

  return receipt
}

export function parseStoredActionInput(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  const canonicalMessage = typeof candidate.canonicalMessage === 'string' ? candidate.canonicalMessage : ''
  const rawMessage = typeof candidate.rawMessage === 'string' ? candidate.rawMessage : canonicalMessage
  return canonicalMessage ? { canonicalMessage, rawMessage } : null
}

export function createPreviewAnswer(card: AiActionPreviewCard) {
  return [
    '**Action Preview**',
    card.summary,
    '',
    '**Proposed Changes**',
    ...card.changes.map((change) => `- ${change}`),
    card.warnings.length ? '' : '',
    card.warnings.length ? '**Risk Controls**' : '',
    ...card.warnings.map((warning) => `- ${warning}`),
    '',
    '**Governance**',
    '- Dry-run completed. No workspace data has been changed.',
    '- Confirmation is required before execution.',
    `- Confirmation expires at ${new Date(card.confirmationExpiresAt).toLocaleString('en-US')}.`,
  ].filter(Boolean).join('\n')
}

export function governanceJson(value: Record<string, unknown>) {
  return jsonObject(value)
}
