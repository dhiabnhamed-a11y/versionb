import 'server-only'

import type { AiPlanRequest } from '@/modules/ai/dto/runtime.dto'
import { evaluateAiRequestSafety } from '@/modules/ai/evaluators/safety'
import { planOperationalAiRun } from '@/modules/ai/runtime/engine'

export async function createOperationalAiPlan(input: AiPlanRequest) {
  const safety = evaluateAiRequestSafety({ goal: input.goal, mutating: true })
  if (safety.blocked) {
    return {
      blocked: true,
      safety,
      result: null,
    }
  }

  return {
    blocked: false,
    safety,
    result: await planOperationalAiRun(input),
  }
}
