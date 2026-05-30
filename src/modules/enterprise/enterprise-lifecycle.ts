import { Prisma } from '@prisma/client'
import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { recordEnterpriseAudit } from '@/modules/enterprise/enterprise-audit'
import { badRequest } from '@/modules/shared/errors'
import { publishDomainEvent } from '@/modules/events/event-bus'
import type { SessionUser } from '@/modules/shared/session'

const ASSET_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  PROCURED: ['IN_SERVICE', 'STORAGE', 'DISPOSED'],
  IN_SERVICE: ['MAINTENANCE', 'STORAGE', 'RETIRED', 'DISPOSED'],
  MAINTENANCE: ['IN_SERVICE', 'RETIRED', 'DISPOSED'],
  STORAGE: ['IN_SERVICE', 'RETIRED', 'DISPOSED'],
  RETIRED: ['DISPOSED'],
  DISPOSED: [],
}

const ASSET_OPERATIONAL_TRANSITIONS: Record<string, string[]> = {
  OPERATIONAL: ['DEGRADED', 'OFFLINE', 'OUT_OF_SERVICE'],
  DEGRADED: ['OPERATIONAL', 'OFFLINE', 'OUT_OF_SERVICE'],
  OFFLINE: ['OPERATIONAL', 'DEGRADED', 'OUT_OF_SERVICE'],
  OUT_OF_SERVICE: [],
}

export function isValidLifecycleTransition(from: string, to: string): boolean {
  const allowed = ASSET_LIFECYCLE_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

export function isValidOperationalTransition(from: string, to: string): boolean {
  const allowed = ASSET_OPERATIONAL_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

export async function transitionAssetLifecycle(
  user: SessionUser,
  assetId: string,
  input: { lifecycleState: string; retiredReason?: string | null }
) {
  const companyId = user.companyId
  if (!companyId) throw badRequest('No company found.')

  const asset = await enterpriseRepositoryPrisma.enterpriseAsset.findFirst({
    where: { id: assetId, companyId, deletedAt: null },
  })
  if (!asset) throw Object.assign(new Error('Asset not found.'), { status: 404 })

  const targetState = input.lifecycleState.toUpperCase()
  if (!isValidLifecycleTransition(asset.lifecycleState, targetState)) {
    throw badRequest(`Invalid lifecycle transition: ${asset.lifecycleState} → ${targetState}. Allowed: ${ASSET_LIFECYCLE_TRANSITIONS[asset.lifecycleState]?.join(', ') || 'none'}`)
  }

  const updated = await enterpriseRepositoryPrisma.enterpriseAsset.update({
    where: { id: assetId },
    data: {
      lifecycleState: targetState,
      retiredAt: targetState === 'RETIRED' || targetState === 'DISPOSED' ? new Date() : (targetState === 'IN_SERVICE' ? null : undefined),
      retiredReason: input.retiredReason ?? (targetState === 'RETIRED' || targetState === 'DISPOSED' ? 'Lifecycle transition' : undefined),
    },
  })

  await recordEnterpriseAudit({
    companyId,
    actorId: user.id,
    action: 'enterprise.asset.lifecycle_transition',
    entityType: 'enterprise_asset',
    entityId: assetId,
    before: { lifecycleState: asset.lifecycleState },
    after: { lifecycleState: targetState },
  })

  await publishDomainEvent({
    type: 'enterprise.asset.updated', companyId, actorId: user.id,
    entityType: 'enterprise_asset', entityId: assetId,
    action: `Asset lifecycle: ${asset.lifecycleState} → ${targetState}`,
    payload: { asset: updated, previousState: asset.lifecycleState, newState: targetState },
    before: asset, after: updated,
  })

  return updated
}

export async function transitionAssetOperationalStatus(
  user: SessionUser,
  assetId: string,
  input: { operationalStatus: string }
) {
  const companyId = user.companyId
  if (!companyId) throw badRequest('No company found.')

  const asset = await enterpriseRepositoryPrisma.enterpriseAsset.findFirst({
    where: { id: assetId, companyId, deletedAt: null },
  })
  if (!asset) throw Object.assign(new Error('Asset not found.'), { status: 404 })

  const targetStatus = input.operationalStatus.toUpperCase()
  if (!isValidOperationalTransition(asset.operationalStatus, targetStatus)) {
    throw badRequest(`Invalid operational transition: ${asset.operationalStatus} → ${targetStatus}. Allowed: ${ASSET_OPERATIONAL_TRANSITIONS[asset.operationalStatus]?.join(', ') || 'none'}`)
  }

  const updated = await enterpriseRepositoryPrisma.enterpriseAsset.update({
    where: { id: assetId },
    data: {
      operationalStatus: targetStatus,
      healthScore: targetStatus === 'OPERATIONAL' ? { increment: 10 } : targetStatus === 'OUT_OF_SERVICE' ? 0 : undefined,
    },
  })

  await recordEnterpriseAudit({
    companyId,
    actorId: user.id,
    action: 'enterprise.asset.operational_transition',
    entityType: 'enterprise_asset',
    entityId: assetId,
    before: { operationalStatus: asset.operationalStatus },
    after: { operationalStatus: targetStatus },
  })

  return updated
}
