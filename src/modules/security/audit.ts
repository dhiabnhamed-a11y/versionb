import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { toJsonValue } from '@/modules/shared/json'
import { logger } from '@/modules/shared/logger'

export type SecurityAuditInput = {
  action: string
  actorId?: string | null
  companyId?: string | null
  entityId?: string | null
  entityType?: string
  ipAddress?: string | null
  metadata?: unknown
  requestId?: string | null
  userAgent?: string | null
}

export async function recordSecurityAudit(input: SecurityAuditInput) {
  try {
    return await prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? null,
        companyId: input.companyId ?? null,
        entityId: input.entityId ?? input.requestId ?? 'unknown',
        entityType: input.entityType ?? 'security_event',
        ipAddress: input.ipAddress ?? null,
        metadata: toJsonValue(input.metadata),
        requestId: input.requestId ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      logger.warn('security.audit_skipped_missing_schema', { action: input.action, requestId: input.requestId })
      return null
    }

    logger.error('security.audit_write_failed', error, { action: input.action, requestId: input.requestId })
    return null
  }
}
