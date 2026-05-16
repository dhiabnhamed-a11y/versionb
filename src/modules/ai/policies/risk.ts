import type { AiToolDefinition, AiToolRiskLevel } from '@/modules/ai/tools/types'

const RISK_WEIGHT: Record<AiToolRiskLevel, number> = {
  LOW: 10,
  MEDIUM: 35,
  HIGH: 70,
  CRITICAL: 95,
}

export function riskWeight(riskLevel: AiToolRiskLevel) {
  return RISK_WEIGHT[riskLevel]
}

export function highestRiskLevel(levels: AiToolRiskLevel[]): AiToolRiskLevel {
  return levels.reduce<AiToolRiskLevel>((highest, current) => (riskWeight(current) > riskWeight(highest) ? current : highest), 'LOW')
}

export function toolRequiresApproval(tool: AiToolDefinition) {
  return tool.riskLevel === 'HIGH' || tool.riskLevel === 'CRITICAL' || tool.permissions.includes('finance.manage')
}

export function buildToolPolicySnapshot(tool: AiToolDefinition) {
  return {
    toolName: tool.name,
    toolKey: tool.key ?? tool.name,
    riskLevel: tool.riskLevel,
    permissions: tool.permissions,
    mutating: tool.mutating,
    requiresConfirmation: tool.requiresConfirmation,
    requiresApproval: toolRequiresApproval(tool),
    supportsDryRun: tool.supportsDryRun,
    supportsRollback: tool.supportsRollback,
    rollbackStrategy: tool.rollback.strategy,
  }
}
