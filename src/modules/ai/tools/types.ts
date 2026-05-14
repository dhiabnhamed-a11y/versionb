import type { Prisma } from '@prisma/client'

export type AiToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type AiToolPermission =
  | 'workspace.manage'
  | 'finance.manage'
  | 'alerts.send'
  | 'records.delete'

export type AiToolSchemaField = {
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'
  required?: boolean
  description: string
}

export type AiToolDefinition = {
  name: string
  displayName: string
  description: string
  actionKinds: string[]
  permissions: AiToolPermission[]
  riskLevel: AiToolRiskLevel
  mutating: boolean
  requiresConfirmation: boolean
  supportsDryRun: boolean
  supportsRollback: boolean
  tenantScoped: boolean
  rateLimit: {
    windowSeconds: number
    max: number
  }
  schema: {
    input: Record<string, AiToolSchemaField>
  }
  audit: {
    category: string
    event: string
  }
  rollback: {
    strategy: 'metadata_snapshot' | 'compensating_action' | 'manual_review'
    notes: string
  }
  metadata?: Prisma.JsonObject
}
