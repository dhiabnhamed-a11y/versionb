import type { AiExecutionPlanDto, AiPlanStepDto, AiRiskLevel } from '@/modules/ai/dto/runtime.dto'
import { highestRiskLevel, toolRequiresApproval } from '@/modules/ai/policies/risk'
import { canUseAiTool } from '@/modules/ai/permissions/checker'
import { getAiToolForActionKind } from '@/modules/ai/tools/registry'
import type { AiToolDefinition, AiToolRiskLevel } from '@/modules/ai/tools/types'

type PlannerActor = {
  role: string
}

const ONBOARDING_ACTIONS = ['client', 'generate_contract', 'campaign', 'create_project_plan', 'invoice']

function inferActionKinds(goal: string) {
  const normalized = goal.toLowerCase()
  if (normalized.includes('onboarding')) return ONBOARDING_ACTIONS
  if (normalized.includes('financial report') || normalized.includes('finance report')) return ['generate_financial_report']
  if (normalized.includes('workflow')) return ['create_workflow_rule']
  if (normalized.includes('budget')) return ['create_budget']
  if (normalized.includes('contract')) return ['generate_contract']
  return ['client', 'campaign', 'brief'].filter((action) => normalized.includes(action))
}

function stepName(tool: AiToolDefinition, sequence: number) {
  return `${sequence}. ${tool.displayName}`
}

function toPlanStep(tool: AiToolDefinition, sequence: number, actor: PlannerActor): AiPlanStepDto {
  const permission = canUseAiTool(actor, tool)
  return {
    sequence,
    name: stepName(tool, sequence),
    toolName: tool.name,
    actionKind: tool.actionKinds[0] ?? tool.name,
    riskLevel: tool.riskLevel as AiRiskLevel,
    requiresConfirmation: tool.requiresConfirmation,
    requiresApproval: toolRequiresApproval(tool) || !permission.allowed,
    permissions: tool.permissions,
    rollbackStrategy: tool.rollback.strategy,
  }
}

export function buildAiExecutionPlan(input: { goal: string; actor: PlannerActor }): AiExecutionPlanDto {
  const tools = inferActionKinds(input.goal)
    .map((actionKind) => getAiToolForActionKind(actionKind))
    .filter((tool): tool is AiToolDefinition => Boolean(tool))

  const steps = tools.map((tool, index) => toPlanStep(tool, index + 1, input.actor))
  const riskLevel = highestRiskLevel(steps.map((step) => step.riskLevel as AiToolRiskLevel))
  const warnings = steps.length
    ? []
    : ['No registered AI tools could be safely mapped to this goal. The runtime should ask for clarification before execution.']

  return {
    goal: input.goal,
    riskLevel,
    estimatedCostUsd: Number((steps.length * 0.015 + (riskLevel === 'CRITICAL' ? 0.05 : 0)).toFixed(4)),
    requiresApproval: steps.some((step) => step.requiresApproval),
    canExecuteImmediately: false,
    steps,
    warnings,
  }
}
