import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { logger } from '@/modules/shared/logger'
import { toJsonValue } from '@/modules/shared/json'

type PrismaWithOptionalIntegrationDelegates = typeof prisma & {
  integrationActivityLog?: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>
  }
}

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
    const prismaWithOptionalDelegates = prisma as PrismaWithOptionalIntegrationDelegates
    const writes: Array<Promise<unknown>> = [
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
    ]

    if (prismaWithOptionalDelegates.integrationActivityLog?.create) {
      writes.push(
        prismaWithOptionalDelegates.integrationActivityLog.create({
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
        })
      )
    } else {
      logger.warn('integrations.activity_log_delegate_missing', { action: input.action, companyId: input.companyId })
    }

    await Promise.all(writes)
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      logger.warn('integrations.audit_skipped_missing_schema', { action: input.action, companyId: input.companyId })
      return
    }
    logger.warn('integrations.audit_write_failed', {
      action: input.action,
      companyId: input.companyId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
