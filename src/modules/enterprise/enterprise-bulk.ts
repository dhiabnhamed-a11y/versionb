import { Prisma } from '@prisma/client'
import { enterpriseRepositoryPrisma, enterpriseRepositoryTransaction } from '@/modules/enterprise/enterprise.repository'
import { recordEnterpriseAuditTx } from '@/modules/enterprise/enterprise-audit'
import { assertCan } from '@/modules/permissions/permissions'
import { badRequest } from '@/modules/shared/errors'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { isValidIncidentTransition, isValidChangeTransition } from '@/modules/enterprise/enterprise.validation'
import type { SessionUser } from '@/modules/shared/session'

function companyId(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found.')
  return user.companyId
}

interface BulkResult {
  succeeded: number
  failed: number
  errors: { id: string; error: string }[]
}

// ── Bulk Incident Status Update ──────────────────────────────────

export async function bulkUpdateIncidentStatus(
  user: SessionUser,
  ids: string[],
  newStatus: string,
  resolution?: string | null
): Promise<BulkResult> {
  const cid = companyId(user)
  assertCan(user, 'update', 'incident', { companyId: cid })
  const result: BulkResult = { succeeded: 0, failed: 0, errors: [] }

  for (const id of ids) {
    try {
      const incident = await enterpriseRepositoryPrisma.enterpriseIncident.findFirst({ where: { id, companyId: cid } })
      if (!incident) { result.failed++; result.errors.push({ id, error: 'Not found' }); continue }

      if (!isValidIncidentTransition(incident.status, newStatus)) {
        result.failed++; result.errors.push({ id, error: `Invalid transition: ${incident.status} → ${newStatus}` }); continue
      }

      await enterpriseRepositoryPrisma.enterpriseIncident.update({
        where: { id },
        data: {
          status: newStatus,
          resolvedAt: newStatus === 'RESOLVED' ? new Date() : undefined,
          closedAt: newStatus === 'CLOSED' ? new Date() : undefined,
          resolution: resolution ?? undefined,
        },
      })

      result.succeeded++
    } catch (err: any) {
      result.failed++
      result.errors.push({ id, error: err.message })
    }
  }

  return result
}

// ── Bulk Assign ──────────────────────────────────────────────────

export async function bulkAssign(
  user: SessionUser,
  entityType: 'incident' | 'asset' | 'maintenance',
  ids: string[],
  assigneeId: string
): Promise<BulkResult> {
  const cid = companyId(user)
  assertCan(user, 'update', 'incident', { companyId: cid })
  const result: BulkResult = { succeeded: 0, failed: 0, errors: [] }

  for (const id of ids) {
    try {
      switch (entityType) {
        case 'incident':
          await enterpriseRepositoryPrisma.enterpriseIncident.updateMany({
            where: { id, companyId: cid },
            data: { assignedToId: assigneeId },
          })
          break
        case 'asset':
          await enterpriseRepositoryPrisma.enterpriseAsset.updateMany({
            where: { id, companyId: cid, deletedAt: null },
            data: { assignedUserId: assigneeId },
          })
          break
        case 'maintenance':
          await enterpriseRepositoryPrisma.enterpriseMaintenanceWorkOrder.updateMany({
            where: { id, companyId: cid },
            data: { assignedTechnicianId: assigneeId },
          })
          break
      }
      result.succeeded++
    } catch (err: any) {
      result.failed++
      result.errors.push({ id, error: err.message })
    }
  }

  return result
}

// ── Bulk Team Assign ─────────────────────────────────────────────

export async function bulkAssignTeam(
  user: SessionUser,
  entityType: 'incident' | 'asset',
  ids: string[],
  teamId: string
): Promise<BulkResult> {
  const cid = companyId(user)
  assertCan(user, 'update', 'incident', { companyId: cid })
  const result: BulkResult = { succeeded: 0, failed: 0, errors: [] }

  for (const id of ids) {
    try {
      switch (entityType) {
        case 'incident':
          await enterpriseRepositoryPrisma.enterpriseIncident.updateMany({
            where: { id, companyId: cid },
            data: { assignedTeamId: teamId },
          })
          break
        case 'asset':
          await enterpriseRepositoryPrisma.enterpriseAsset.updateMany({
            where: { id, companyId: cid, deletedAt: null },
            data: { assignedTeamId: teamId },
          })
          break
      }
      result.succeeded++
    } catch (err: any) {
      result.failed++
      result.errors.push({ id, error: err.message })
    }
  }

  return result
}

// ── Bulk Priority Change ────────────────────────────────────────

export async function bulkUpdatePriority(
  user: SessionUser,
  entityType: 'incident' | 'change',
  ids: string[],
  priority: string
): Promise<BulkResult> {
  const cid = companyId(user)
  assertCan(user, 'update', 'incident', { companyId: cid })
  const result: BulkResult = { succeeded: 0, failed: 0, errors: [] }

  for (const id of ids) {
    try {
      switch (entityType) {
        case 'incident':
          await enterpriseRepositoryPrisma.enterpriseIncident.updateMany({
            where: { id, companyId: cid },
            data: { priority: priority.toUpperCase() },
          })
          break
        case 'change':
          await enterpriseRepositoryPrisma.enterpriseChange.updateMany({
            where: { id, companyId: cid },
            data: { priority: priority.toUpperCase() },
          })
          break
      }
      result.succeeded++
    } catch (err: any) {
      result.failed++
      result.errors.push({ id, error: err.message })
    }
  }

  return result
}

// ── Bulk Delete ──────────────────────────────────────────────────

export async function bulkDeleteAssets(user: SessionUser, ids: string[]): Promise<BulkResult> {
  const cid = companyId(user)
  assertCan(user, 'update', 'asset', { companyId: cid })
  const result: BulkResult = { succeeded: 0, failed: 0, errors: [] }

  for (const id of ids) {
    try {
      await enterpriseRepositoryPrisma.enterpriseAsset.update({
        where: { id, companyId: cid },
        data: { deletedAt: new Date() },
      })
      result.succeeded++
    } catch (err: any) {
      result.failed++
      result.errors.push({ id, error: err.message })
    }
  }

  return result
}
