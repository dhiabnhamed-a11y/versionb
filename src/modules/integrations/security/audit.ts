import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { logger } from '@/modules/shared/logger'
import { toJsonValue } from '@/modules/shared/json'

export async function recordIntegrationActivity(input: {
  companyId: string
  connectedAccountId?: string | null
  actorId?: string | null
  action: string
  severity?: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY'
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: unknown
}) {
  try {
    await Promise.all([
      prisma.integrationActivityLog.create({
        data: {
          companyId: input.companyId,
          connectedAccountId: input.connectedAccountId ?? null,
          actorId: input.actorId ?? null,
          action: input.action,
          severity: input.severity ?? 'INFO',
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          metadata: toJsonValue(input.metadata),
        },
      }),
      prisma.auditLog.create({
        data: {
          companyId: input.companyId,
          actorId: input.actorId ?? null,
          action: input.action,
          entityType: 'social_integration',
          entityId: input.connectedAccountId ?? input.companyId,
          metadata: toJsonValue(input.metadata),
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      }),
    ])
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      logger.warn('integrations.audit_skipped_missing_schema', { action: input.action, companyId: input.companyId })
      return
    }
    throw error
  }
}
