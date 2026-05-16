import type { Prisma } from '@prisma/client'
import type { z } from 'zod'

export type AiToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type AiToolPermission =
  | 'workspace.manage'
  | 'finance.manage'
  | 'alerts.send'
  | 'records.delete'
  | 'contracts.manage'
  | 'projects.manage'
  | 'tasks.manage'
  | 'approvals.manage'
  | 'workflows.manage'
  | 'reports.generate'

export type AiToolSchemaField = {
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'
  required?: boolean
  description: string
}

export type AiToolDefinition = {
  key?: string
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
  inputSchema?: z.ZodType<unknown>
  outputSchema?: z.ZodType<unknown>
  idempotency?: {
    required: boolean
    scope: 'actor' | 'company' | 'target'
    keyFields: string[]
  }
  execution?: {
    mode: 'sync' | 'async' | 'hybrid'
    queue?: string
    maxAttempts: number
    timeoutMs: number
  }
  emitsEvents?: string[]
  confirmation?: {
    requiredForRisk: AiToolRiskLevel[]
    expiresInMinutes: number
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
