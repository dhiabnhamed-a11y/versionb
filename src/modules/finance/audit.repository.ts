import 'server-only'

import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { toJsonValue } from '@/modules/shared/json'

export type FinancialAuditInput = {
  companyId: string
  actorId?: string | null
  action: string
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
  metadata?: unknown
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

export async function writeFinancialAuditLog(tx: Prisma.TransactionClient, input: FinancialAuditInput) {
  const latest = await tx.financialAuditLog.findFirst({
    where: { companyId: input.companyId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { hash: true },
  })
  const before = toJsonValue(input.before)
  const after = toJsonValue(input.after)
  const metadata = toJsonValue(input.metadata)
  const payload = {
    companyId: input.companyId,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before,
    after,
    metadata,
    previousHash: latest?.hash ?? null,
  }
  const hash = createHash('sha256').update(stableStringify(payload)).digest('hex')

  return tx.financialAuditLog.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before,
      after,
      metadata,
      previousHash: latest?.hash ?? null,
      hash,
    },
  })
}
