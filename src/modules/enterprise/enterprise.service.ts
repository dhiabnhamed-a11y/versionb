import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { isEnterpriseOperationsCompanyType } from '@/lib/company-types'
import { assertCan, canManageWorkspace } from '@/modules/permissions/permissions'
import { badRequest, forbidden, notFound } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { registerEnterpriseEventListeners } from '@/modules/events/listeners'
import {
  createEnterpriseAssetSchema,
  createEnterpriseIncidentSchema,
  createMaintenanceWorkOrderSchema,
  updateEnterpriseIncidentSchema,
  updateMaintenanceWorkOrderSchema,
} from '@/modules/enterprise/enterprise.validation'
import {
  enterpriseRepositoryPrisma as prisma,
  enterpriseRepositoryTransaction,
  listEnterpriseAssetCategories,
  listEnterpriseAssets,
  listEnterpriseDepartments,
  listEnterpriseIncidents,
  listEnterpriseTeams,
  listMaintenanceWorkOrders,
} from '@/modules/enterprise/enterprise.repository'

registerEnterpriseEventListeners()

function requireEnterpriseCompany(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found for this account.')
  if (!isEnterpriseOperationsCompanyType(user.companyType)) {
    throw forbidden('Enterprise operations modules are available for healthcare and enterprise operations workspaces.')
  }
  return user.companyId
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest('Invalid date value.')
  return date
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function auditHash(input: unknown) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

async function recordEnterpriseAudit(
  tx: Prisma.TransactionClient,
  input: {
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

async function assertCompanyRecord<T extends { id: string }>(
  loader: Promise<T | null>,
  message = 'Selected enterprise record was not found in this workspace.'
) {
  const record = await loader
  if (!record) throw notFound(message)
  return record
}

async function nextSequenceNumber(tx: Prisma.TransactionClient, companyId: string, prefix: 'INC' | 'MWO') {
  const [count] =
    prefix === 'INC'
      ? await Promise.all([tx.enterpriseIncident.count({ where: { companyId } })])
      : await Promise.all([tx.enterpriseMaintenanceWorkOrder.count({ where: { companyId } })])
  return `${prefix}-${String(count + 1).padStart(6, '0')}`
}

export async function getEnterpriseOperationsDashboard(user: SessionUser) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'read', 'analytics', { companyId })

  const now = new Date()
  const [
    departments,
    teams,
    categories,
    assets,
    incidents,
    maintenance,
    openIncidents,
    breachedIncidents,
    highRiskAssets,
    overdueMaintenance,
    complianceDue,
    auditEvents,
  ] = await Promise.all([
    listEnterpriseDepartments(companyId),
    listEnterpriseTeams(companyId),
    listEnterpriseAssetCategories(companyId),
    listEnterpriseAssets(companyId, { take: 12 }),
    listEnterpriseIncidents(companyId, { take: 12 }),
    listMaintenanceWorkOrders(companyId, { take: 12 }),
    prisma.enterpriseIncident.count({ where: { companyId, status: { in: ['OPEN', 'TRIAGED', 'IN_PROGRESS'] } } }),
    prisma.enterpriseIncident.count({
      where: {
        companyId,
        status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] },
        resolutionDueAt: { lt: now },
      },
    }),
    prisma.enterpriseAsset.count({ where: { companyId, deletedAt: null, OR: [{ riskScore: { gte: 70 } }, { healthScore: { lte: 55 } }] } }),
    prisma.enterpriseMaintenanceWorkOrder.count({
      where: { companyId, status: { notIn: ['COMPLETED', 'CANCELLED'] }, dueAt: { lt: now } },
    }),
    prisma.enterpriseComplianceControl.count({
      where: { companyId, status: 'ACTIVE', nextReviewAt: { lte: addMinutes(now, 30 * 24 * 60) } },
    }),
    prisma.enterpriseAuditEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
  ])

  const assetHealthAverage = assets.length ? Math.round(assets.reduce((sum, asset) => sum + asset.healthScore, 0) / assets.length) : 100
  const slaCompliance = openIncidents + breachedIncidents === 0 ? 100 : Math.max(0, Math.round(100 - (breachedIncidents / Math.max(openIncidents, 1)) * 100))

  const copilotSignals = [
    ...(overdueMaintenance
      ? [
          {
            id: 'maintenance-overdue',
            copilot: 'Asset Copilot',
            severity: 'HIGH',
            title: 'Overdue maintenance detected',
            recommendation: 'Review overdue work orders and reassign blocked maintenance before more assets enter risk.',
            evidence: { overdueMaintenance },
          },
        ]
      : []),
    ...(highRiskAssets
      ? [
          {
            id: 'asset-risk',
            copilot: 'Operations Copilot',
            severity: 'HIGH',
            title: 'High-risk assets need attention',
            recommendation: 'Prioritize inspection or replacement planning for assets with elevated risk or low health scores.',
            evidence: { highRiskAssets },
          },
        ]
      : []),
    ...(breachedIncidents
      ? [
          {
            id: 'sla-breach',
            copilot: 'Incident Copilot',
            severity: 'CRITICAL',
            title: 'SLA breach risk is active',
            recommendation: 'Escalate breached incidents and confirm response ownership.',
            evidence: { breachedIncidents },
          },
        ]
      : []),
    ...(complianceDue
      ? [
          {
            id: 'compliance-review',
            copilot: 'Compliance Copilot',
            severity: 'MEDIUM',
            title: 'Compliance reviews are due soon',
            recommendation: 'Prepare evidence exports and request department manager attestation.',
            evidence: { complianceDue },
          },
        ]
      : []),
  ]

  return {
    companyType: user.companyType,
    metrics: {
      departments: departments.length,
      teams: teams.length,
      assetCategories: categories.length,
      assets: assets.length,
      openIncidents,
      breachedIncidents,
      overdueMaintenance,
      highRiskAssets,
      complianceDue,
      assetHealthAverage,
      slaCompliance,
    },
    departments,
    teams,
    categories,
    assets,
    incidents,
    maintenance,
    auditEvents,
    copilotSignals,
  }
}

export async function listAssets(user: SessionUser) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'read', 'asset', { companyId })
  return listEnterpriseAssets(companyId)
}

export async function createAsset(user: SessionUser, rawInput: unknown, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'create', 'asset', { companyId })
  if (!canManageWorkspace(user)) throw forbidden()

  const input = createEnterpriseAssetSchema.parse(rawInput)

  const [category, department, assignedTeam, assignedUser] = await Promise.all([
    assertCompanyRecord(prisma.enterpriseAssetCategory.findFirst({ where: { id: input.categoryId, companyId } }), 'Asset category not found.'),
    input.departmentId
      ? assertCompanyRecord(prisma.enterpriseDepartment.findFirst({ where: { id: input.departmentId, companyId } }), 'Department not found.')
      : null,
    input.assignedTeamId
      ? assertCompanyRecord(prisma.enterpriseTeam.findFirst({ where: { id: input.assignedTeamId, companyId } }), 'Team not found.')
      : null,
    input.assignedUserId
      ? assertCompanyRecord(prisma.user.findFirst({ where: { id: input.assignedUserId, companyId } }), 'Assigned user not found.')
      : null,
  ])

  const asset = await enterpriseRepositoryTransaction(async (tx) => {
    const created = await tx.enterpriseAsset.create({
      data: {
        companyId,
        categoryId: category.id,
        departmentId: department?.id ?? null,
        assignedTeamId: assignedTeam?.id ?? null,
        assignedUserId: assignedUser?.id ?? null,
        name: input.name,
        assetTag: input.assetTag,
        qrCode: input.qrCode || null,
        barcode: input.barcode || null,
        serialNumber: input.serialNumber || null,
        vendor: input.vendor || null,
        location: input.location || null,
        warrantyExpiresAt: parseDate(input.warrantyExpiresAt),
        purchaseDate: parseDate(input.purchaseDate),
        purchaseCost: input.purchaseCost == null ? undefined : new Prisma.Decimal(input.purchaseCost),
        lifecycleState: input.lifecycleState?.toUpperCase() || 'IN_SERVICE',
        operationalStatus: input.operationalStatus?.toUpperCase() || 'OPERATIONAL',
        healthScore: input.healthScore ?? 100,
        riskScore: input.riskScore ?? Math.max(0, category.riskWeight - 40),
      },
      include: { category: true, department: true, assignedTeam: true, assignedUser: true },
    })

    await recordEnterpriseAudit(tx, {
      companyId,
      actorId: user.id,
      action: 'enterprise.asset.created',
      entityType: 'enterprise_asset',
      entityId: created.id,
      after: created,
      requestId,
    })
    return created
  })

  await publishDomainEvent({
    type: 'enterprise.asset.created',
    companyId,
    actorId: user.id,
    entityType: 'enterprise_asset',
    entityId: asset.id,
    action: 'Enterprise asset created',
    payload: { asset },
    after: asset,
  })

  return asset
}

export async function listIncidents(user: SessionUser) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'read', 'incident', { companyId })
  return listEnterpriseIncidents(companyId)
}

export async function createIncident(user: SessionUser, rawInput: unknown, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'create', 'incident', { companyId })
  const input = createEnterpriseIncidentSchema.parse(rawInput)
  const now = new Date()

  const [department, assignedTeam, assignedTo, asset, slaPolicy] = await Promise.all([
    input.departmentId
      ? assertCompanyRecord(prisma.enterpriseDepartment.findFirst({ where: { id: input.departmentId, companyId } }), 'Department not found.')
      : null,
    input.assignedTeamId
      ? assertCompanyRecord(prisma.enterpriseTeam.findFirst({ where: { id: input.assignedTeamId, companyId } }), 'Team not found.')
      : null,
    input.assignedToId ? assertCompanyRecord(prisma.user.findFirst({ where: { id: input.assignedToId, companyId } }), 'Assignee not found.') : null,
    input.assetId
      ? assertCompanyRecord(prisma.enterpriseAsset.findFirst({ where: { id: input.assetId, companyId, deletedAt: null } }), 'Asset not found.')
      : null,
    prisma.enterpriseSlaPolicy.findFirst({
      where: { companyId, priority: input.priority.toUpperCase(), severity: input.severity.toUpperCase(), status: 'ACTIVE' },
      orderBy: [{ defaultPolicy: 'desc' }, { createdAt: 'asc' }],
    }),
  ])

  const incident = await enterpriseRepositoryTransaction(async (tx) => {
    const incidentNumber = await nextSequenceNumber(tx, companyId, 'INC')
    const created = await tx.enterpriseIncident.create({
      data: {
        companyId,
        incidentNumber,
        title: input.title,
        description: input.description || null,
        type: input.type.toUpperCase(),
        priority: input.priority.toUpperCase(),
        severity: input.severity.toUpperCase(),
        impact: input.impact.toUpperCase(),
        urgency: input.urgency.toUpperCase(),
        source: input.source.toUpperCase(),
        departmentId: department?.id ?? asset?.departmentId ?? null,
        assignedTeamId: assignedTeam?.id ?? asset?.assignedTeamId ?? null,
        reportedById: user.id,
        assignedToId: assignedTo?.id ?? null,
        assetId: asset?.id ?? null,
        slaPolicyId: slaPolicy?.id ?? null,
        responseDueAt: slaPolicy ? addMinutes(now, slaPolicy.responseMinutes) : null,
        resolutionDueAt: slaPolicy ? addMinutes(now, slaPolicy.resolutionMinutes) : null,
        auditTrail: [{ at: now.toISOString(), actorId: user.id, action: 'created' }],
      },
      include: { asset: true, assignedTeam: true, department: true, slaPolicy: true, reportedBy: true },
    })

    if (asset) {
      await tx.enterpriseAsset.update({
        where: { id: asset.id },
        data: {
          operationalStatus: input.priority.toUpperCase() === 'P1' ? 'IMPAIRED' : asset.operationalStatus,
          riskScore: Math.min(100, Math.max(asset.riskScore, input.priority.toUpperCase() === 'P1' ? 85 : 60)),
        },
      })
    }

    await recordEnterpriseAudit(tx, {
      companyId,
      actorId: user.id,
      action: 'enterprise.incident.created',
      entityType: 'enterprise_incident',
      entityId: created.id,
      after: created,
      requestId,
    })
    return created
  })

  await publishDomainEvent({
    type: 'enterprise.incident.created',
    companyId,
    actorId: user.id,
    entityType: 'enterprise_incident',
    entityId: incident.id,
    action: 'Enterprise incident created',
    payload: { incident },
    after: incident,
  })

  return incident
}

export async function updateIncident(user: SessionUser, id: string, rawInput: unknown, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  const input = updateEnterpriseIncidentSchema.parse(rawInput)
  const existing = await prisma.enterpriseIncident.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Incident not found.')
  assertCan(user, 'update', 'incident', { companyId, assigneeId: existing.assignedToId, assignedUserIds: [existing.reportedById ?? ''] })

  await Promise.all([
    input.assignedTeamId
      ? assertCompanyRecord(prisma.enterpriseTeam.findFirst({ where: { id: input.assignedTeamId, companyId } }), 'Team not found.')
      : null,
    input.assignedToId ? assertCompanyRecord(prisma.user.findFirst({ where: { id: input.assignedToId, companyId } }), 'Assignee not found.') : null,
  ])

  const resolved = input.status && ['RESOLVED', 'CLOSED'].includes(input.status.toUpperCase())
  const updated = await enterpriseRepositoryTransaction(async (tx) => {
    const next = await tx.enterpriseIncident.update({
      where: { id },
      data: {
        status: input.status?.toUpperCase(),
        assignedTeamId: input.assignedTeamId === undefined ? undefined : input.assignedTeamId,
        assignedToId: input.assignedToId === undefined ? undefined : input.assignedToId,
        firstRespondedAt: parseDate(input.firstRespondedAt) ?? undefined,
        rootCause: input.rootCause === undefined ? undefined : input.rootCause,
        resolution: input.resolution === undefined ? undefined : input.resolution,
        escalationState: input.escalationState?.toUpperCase(),
        approvalState: input.approvalState?.toUpperCase(),
        resolvedAt: resolved ? new Date() : undefined,
        closedAt: input.status?.toUpperCase() === 'CLOSED' ? new Date() : undefined,
        auditTrail: [
          ...(Array.isArray(existing.auditTrail) ? existing.auditTrail : []),
          { at: new Date().toISOString(), actorId: user.id, action: 'updated', status: input.status },
        ] as Prisma.InputJsonValue,
      },
      include: { asset: true, assignedTeam: true, department: true, assignedTo: true },
    })
    await recordEnterpriseAudit(tx, {
      companyId,
      actorId: user.id,
      action: 'enterprise.incident.updated',
      entityType: 'enterprise_incident',
      entityId: id,
      before: existing,
      after: next,
      requestId,
    })
    return next
  })

  await publishDomainEvent({
    type: 'enterprise.incident.updated',
    companyId,
    actorId: user.id,
    entityType: 'enterprise_incident',
    entityId: id,
    action: 'Enterprise incident updated',
    payload: { incident: updated },
    before: existing,
    after: updated,
  })

  return updated
}

export async function listMaintenance(user: SessionUser) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'read', 'maintenance', { companyId })
  return listMaintenanceWorkOrders(companyId)
}

export async function createMaintenanceWorkOrder(user: SessionUser, rawInput: unknown, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'create', 'maintenance', { companyId })
  const input = createMaintenanceWorkOrderSchema.parse(rawInput)

  await Promise.all([
    input.assetId
      ? assertCompanyRecord(prisma.enterpriseAsset.findFirst({ where: { id: input.assetId, companyId, deletedAt: null } }), 'Asset not found.')
      : null,
    input.planId ? assertCompanyRecord(prisma.enterpriseMaintenancePlan.findFirst({ where: { id: input.planId, companyId } }), 'Plan not found.') : null,
    input.incidentId
      ? assertCompanyRecord(prisma.enterpriseIncident.findFirst({ where: { id: input.incidentId, companyId } }), 'Incident not found.')
      : null,
    input.departmentId
      ? assertCompanyRecord(prisma.enterpriseDepartment.findFirst({ where: { id: input.departmentId, companyId } }), 'Department not found.')
      : null,
    input.assignedTeamId
      ? assertCompanyRecord(prisma.enterpriseTeam.findFirst({ where: { id: input.assignedTeamId, companyId } }), 'Team not found.')
      : null,
    input.assignedTechnicianId
      ? assertCompanyRecord(prisma.user.findFirst({ where: { id: input.assignedTechnicianId, companyId } }), 'Technician not found.')
      : null,
  ])

  const workOrder = await enterpriseRepositoryTransaction(async (tx) => {
    const workOrderNumber = await nextSequenceNumber(tx, companyId, 'MWO')
    const created = await tx.enterpriseMaintenanceWorkOrder.create({
      data: {
        companyId,
        workOrderNumber,
        type: input.type.toUpperCase(),
        priority: input.priority.toUpperCase(),
        assetId: input.assetId ?? null,
        planId: input.planId ?? null,
        incidentId: input.incidentId ?? null,
        departmentId: input.departmentId ?? null,
        assignedTeamId: input.assignedTeamId ?? null,
        assignedTechnicianId: input.assignedTechnicianId ?? null,
        scheduledFor: parseDate(input.scheduledFor),
        dueAt: parseDate(input.dueAt),
      },
      include: { asset: true, incident: true, assignedTeam: true, assignedTechnician: true },
    })
    await recordEnterpriseAudit(tx, {
      companyId,
      actorId: user.id,
      action: 'enterprise.maintenance.created',
      entityType: 'enterprise_maintenance_work_order',
      entityId: created.id,
      after: created,
      requestId,
    })
    return created
  })

  await publishDomainEvent({
    type: 'enterprise.maintenance.created',
    companyId,
    actorId: user.id,
    entityType: 'enterprise_maintenance_work_order',
    entityId: workOrder.id,
    action: 'Enterprise maintenance work order created',
    payload: { workOrder },
    after: workOrder,
  })

  return workOrder
}

export async function updateMaintenanceWorkOrder(user: SessionUser, id: string, rawInput: unknown, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  const input = updateMaintenanceWorkOrderSchema.parse(rawInput)
  const existing = await prisma.enterpriseMaintenanceWorkOrder.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Maintenance work order not found.')
  assertCan(user, 'update', 'maintenance', { companyId, assigneeId: existing.assignedTechnicianId })

  await Promise.all([
    input.assignedTeamId
      ? assertCompanyRecord(prisma.enterpriseTeam.findFirst({ where: { id: input.assignedTeamId, companyId } }), 'Team not found.')
      : null,
    input.assignedTechnicianId
      ? assertCompanyRecord(prisma.user.findFirst({ where: { id: input.assignedTechnicianId, companyId } }), 'Technician not found.')
      : null,
  ])

  const updated = await enterpriseRepositoryTransaction(async (tx) => {
    const completedAt = parseDate(input.completedAt)
    const next = await tx.enterpriseMaintenanceWorkOrder.update({
      where: { id },
      data: {
        status: input.status?.toUpperCase(),
        assignedTeamId: input.assignedTeamId === undefined ? undefined : input.assignedTeamId,
        assignedTechnicianId: input.assignedTechnicianId === undefined ? undefined : input.assignedTechnicianId,
        startedAt: parseDate(input.startedAt) ?? undefined,
        completedAt: completedAt ?? undefined,
        completionReport: input.completionReport as Prisma.InputJsonValue,
        cost: input.cost == null ? undefined : new Prisma.Decimal(input.cost),
      },
      include: { asset: true, incident: true, assignedTeam: true, assignedTechnician: true },
    })

    if (completedAt && existing.assetId) {
      await tx.enterpriseAsset.update({
        where: { id: existing.assetId },
        data: {
          lastMaintenanceAt: completedAt,
          healthScore: { increment: 5 },
          riskScore: { decrement: 5 },
          operationalStatus: 'OPERATIONAL',
        },
      })
    }

    await recordEnterpriseAudit(tx, {
      companyId,
      actorId: user.id,
      action: 'enterprise.maintenance.updated',
      entityType: 'enterprise_maintenance_work_order',
      entityId: id,
      before: existing,
      after: next,
      requestId,
    })
    return next
  })

  await publishDomainEvent({
    type: 'enterprise.maintenance.updated',
    companyId,
    actorId: user.id,
    entityType: 'enterprise_maintenance_work_order',
    entityId: id,
    action: 'Enterprise maintenance work order updated',
    payload: { workOrder: updated },
    before: existing,
    after: updated,
  })

  return updated
}
