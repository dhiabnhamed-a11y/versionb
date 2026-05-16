import 'server-only'

import { aiPlanRequestSchema, type AiPlanRequest } from '@/modules/ai/dto/runtime.dto'
import { buildAiExecutionPlan } from '@/modules/ai/planner/plan'
import { createAiRunSteps, createPlannedAiRun, recordAiDecision, recordAiObservation } from '@/modules/ai/repositories/runtime.repository'
import { toJsonValue } from '@/modules/shared/json'

export async function planOperationalAiRun(input: AiPlanRequest) {
  const request = aiPlanRequestSchema.parse(input)
  const plan = buildAiExecutionPlan({ goal: request.goal, actor: request.actor })
  const aiRun = await createPlannedAiRun({
    actor: request.actor,
    goal: request.goal,
    plan,
    conversationId: request.conversationId ?? null,
    idempotencyKey: request.idempotencyKey ?? null,
  })
  const steps = await createAiRunSteps({
    aiRunId: aiRun.id,
    companyId: request.actor.companyId,
    plan,
  })

  await recordAiDecision({
    aiRunId: aiRun.id,
    companyId: request.actor.companyId,
    actorId: request.actor.id,
    decisionType: 'PLAN',
    rationale: plan.steps.length
      ? 'Generated a dry-run execution plan from registered AI tools. Execution is blocked until preview, confirmation, and required approvals complete.'
      : 'No safe tool mapping was found for the requested goal.',
    inputs: toJsonValue({ goal: request.goal }),
    outputs: toJsonValue(plan),
    riskScore: plan.riskLevel === 'CRITICAL' ? 95 : plan.riskLevel === 'HIGH' ? 70 : plan.riskLevel === 'MEDIUM' ? 35 : 10,
  })

  await recordAiObservation({
    aiRunId: aiRun.id,
    companyId: request.actor.companyId,
    actorId: request.actor.id,
    type: 'TRACE',
    message: `Operational AI run planned with ${steps.length} step${steps.length === 1 ? '' : 's'}.`,
    metadata: { riskLevel: plan.riskLevel, requiresApproval: plan.requiresApproval },
  })

  return { aiRun, steps, plan }
}
