import 'server-only'

import { createAiToolExecutionRecord, recordAiObservation } from '@/modules/ai/repositories/runtime.repository'
import { getAiToolByName } from '@/modules/ai/tools/registry'
import type { AiActor } from '@/modules/ai/dto/runtime.dto'

export async function recordDryRunToolExecution(input: {
  aiRunId: string
  aiStepId?: string | null
  actor: AiActor
  toolName: string
  actionKind: string
  payload: unknown
}) {
  const tool = getAiToolByName(input.toolName)
  if (!tool) {
    await recordAiObservation({
      aiRunId: input.aiRunId,
      aiStepId: input.aiStepId ?? null,
      companyId: input.actor.companyId,
      actorId: input.actor.id,
      type: 'TOOL',
      severity: 'ERROR',
      message: `No registered AI tool found for ${input.toolName}.`,
    })
    return null
  }

  return createAiToolExecutionRecord({
    aiRunId: input.aiRunId,
    aiStepId: input.aiStepId ?? null,
    companyId: input.actor.companyId,
    actorId: input.actor.id,
    toolName: tool.name,
    actionKind: input.actionKind,
    riskLevel: tool.riskLevel,
    requiresConfirmation: tool.requiresConfirmation,
    dryRun: true,
    input: input.payload,
    audit: { category: tool.audit.category, event: tool.audit.event, dryRun: true },
    rollback: tool.rollback,
  })
}
