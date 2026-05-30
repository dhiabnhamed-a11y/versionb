import { createHash } from 'crypto'
import { PrismaClient, Prisma } from '@prisma/client'
import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'

function auditHash(input: unknown) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

export interface AuditInput {
  companyId: string
  actorId?: string | null
  action: string
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
  metadata?: unknown
  requestId?: string | null
}

export async function recordEnterpriseAudit(input: AuditInput) {
  const hash = auditHash(input)
  await enterpriseRepositoryPrisma.enterpriseAuditEvent.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before as Prisma.InputJsonValue,
      after: input.after as Prisma.InputJsonValue,
      metadata: input.metadata as Prisma.InputJsonValue,
      requestId: input.requestId ?? null,
      hash,
    },
  })
}

export async function recordEnterpriseAuditTx(
  tx: Prisma.TransactionClient,
  input: AuditInput
) {
  const hash = auditHash(input)
  await tx.enterpriseAuditEvent.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before as Prisma.InputJsonValue,
      after: input.after as Prisma.InputJsonValue,
      metadata: input.metadata as Prisma.InputJsonValue,
      requestId: input.requestId ?? null,
      hash,
    },
  })
}
