import type { AiActor } from '@/modules/ai/dto/runtime.dto'
import type { AiToolDefinition, AiToolPermission } from '@/modules/ai/tools/types'

type PermissionDecision = {
  allowed: boolean
  missing: AiToolPermission[]
  reason: string
}

const ROLE_PERMISSIONS: Record<string, AiToolPermission[]> = {
  OWNER: [
    'workspace.manage',
    'finance.manage',
    'alerts.send',
    'records.delete',
    'contracts.manage',
    'projects.manage',
    'tasks.manage',
    'approvals.manage',
    'workflows.manage',
    'reports.generate',
  ],
  MANAGER: [
    'workspace.manage',
    'finance.manage',
    'alerts.send',
    'contracts.manage',
    'projects.manage',
    'tasks.manage',
    'approvals.manage',
    'workflows.manage',
    'reports.generate',
  ],
  EMPLOYEE: ['tasks.manage'],
}

function normalizedRole(role: string) {
  return role.trim().toUpperCase() || 'EMPLOYEE'
}

export function permissionsForActor(actor: Pick<AiActor, 'role'>): Set<AiToolPermission> {
  return new Set(ROLE_PERMISSIONS[normalizedRole(actor.role)] ?? [])
}

export function canUseAiTool(actor: Pick<AiActor, 'role'>, tool: AiToolDefinition): PermissionDecision {
  const permissions = permissionsForActor(actor)
  const missing = tool.permissions.filter((permission) => !permissions.has(permission))
  return {
    allowed: missing.length === 0,
    missing,
    reason: missing.length ? `Missing AI capability: ${missing.join(', ')}` : 'Actor is allowed to use this AI tool.',
  }
}
