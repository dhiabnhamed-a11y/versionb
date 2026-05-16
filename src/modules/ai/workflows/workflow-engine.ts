import type { AiActor } from '@/modules/ai/dto/runtime.dto'

export type AiWorkflowRuleDraft = {
  name: string
  trigger: string
  conditions: string[]
  actions: string[]
  enabled: false
  createdBy: string
}

export function draftWorkflowRule(input: {
  actor: AiActor
  instruction: string
}): AiWorkflowRuleDraft {
  return {
    name: input.instruction.slice(0, 90),
    trigger: 'manual.ai_review_required',
    conditions: ['Owner or Manager approval is required before activation.'],
    actions: ['Create governed workflow rule draft', 'Record audit trail', 'Require preview before enablement'],
    enabled: false,
    createdBy: input.actor.id,
  }
}
