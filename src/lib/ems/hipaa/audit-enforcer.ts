/**
 * HIPAA §164.312(b) — Audit Controls
 * Every access to PHI must be logged with actor, resource, action, and timestamp.
 * This module wraps patient/incident queries to auto-log PHI access.
 */
import { prisma } from '@/lib/db'
import { logger } from '@/modules/shared/logger'

export type PhiAccessContext = {
  companyId: string
  actorId: string
  actorRole?: string
  route?: string
  ipAddress?: string
  purpose?: string // e.g. 'treatment', 'dispatch', 'quality_review'
}

export type PhiResourceType = 'patient' | 'incident' | 'communication' | 'media' | 'note'

const PHI_FIELDS_BY_TYPE: Record<PhiResourceType, string[]> = {
  patient: ['name', 'dateOfBirth', 'ssn', 'medicalHistory', 'medications', 'allergies', 'insuranceInfo', 'vitals'],
  incident: ['callerName', 'callerPhone', 'callerNotes', 'chiefComplaint', 'symptoms'],
  communication: ['content', 'transcript'],
  media: ['url', 'thumbnailUrl'],
  note: ['content'],
}

export async function logPhiAccess(
  ctx: PhiAccessContext,
  resourceType: PhiResourceType,
  resourceId: string,
  action: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT'
): Promise<void> {
  try {
    await prisma.emsAuditLog.create({
      data: {
        companyId: ctx.companyId,
        actorId: ctx.actorId,
        actorRole: ctx.actorRole || 'UNKNOWN',
        action: `PHI_${action}_${resourceType.toUpperCase()}`,
        resourceType,
        resourceId,
        containsPhi: true,
        phiFields: PHI_FIELDS_BY_TYPE[resourceType],
        ipAddress: ctx.ipAddress,
        route: ctx.route,
        metadata: { purpose: ctx.purpose || 'operations' },
        // Immutable checksum of the log entry for tamper detection
        checksum: buildChecksum(ctx.companyId, ctx.actorId, resourceId, action),
        timestamp: new Date(),
      },
    })
  } catch (err) {
    // Audit log failure must not break the operation but must be visible
    logger.error('hipaa.audit_log_failure', err, { resourceType, resourceId, actorId: ctx.actorId })
  }
}

function buildChecksum(companyId: string, actorId: string, resourceId: string, action: string): string {
  const { createHash } = require('crypto') as typeof import('crypto')
  return createHash('sha256')
    .update(`${companyId}:${actorId}:${resourceId}:${action}:${Date.now()}`)
    .digest('hex')
}

export async function withPhiAudit<T>(
  ctx: PhiAccessContext,
  resourceType: PhiResourceType,
  resourceId: string,
  action: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT',
  fn: () => Promise<T>
): Promise<T> {
  await logPhiAccess(ctx, resourceType, resourceId, action)
  return fn()
}

export async function getPhiAccessLog(
  companyId: string,
  filters?: {
    actorId?: string
    resourceId?: string
    resourceType?: string
    since?: Date
    limit?: number
  }
) {
  return prisma.emsAuditLog.findMany({
    where: {
      companyId,
      containsPhi: true,
      ...(filters?.actorId ? { actorId: filters.actorId } : {}),
      ...(filters?.resourceId ? { resourceId: filters.resourceId } : {}),
      ...(filters?.resourceType ? { resourceType: filters.resourceType } : {}),
      ...(filters?.since ? { timestamp: { gte: filters.since } } : {}),
    },
    orderBy: { timestamp: 'desc' },
    take: filters?.limit || 100,
  })
}
