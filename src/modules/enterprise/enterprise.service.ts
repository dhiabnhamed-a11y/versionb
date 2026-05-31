import { Prisma } from '@prisma/client'
import { isEnterpriseOperationsCompanyType } from '@/lib/company-types'
import { assertCan, canManageWorkspace } from '@/modules/permissions/permissions'
import { recordEnterpriseAuditTx } from '@/modules/enterprise/enterprise-audit'
import { badRequest, forbidden, notFound } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { registerEnterpriseEventListeners } from '@/modules/events/listeners'
import {
  createEnterpriseAssetSchema,
  createEnterpriseIncidentSchema,
  createEnterpriseProblemSchema,
  updateEnterpriseProblemSchema,
  createEnterpriseChangeSchema,
  updateEnterpriseChangeSchema,
  createMaintenanceWorkOrderSchema,
  updateEnterpriseIncidentSchema,
  updateMaintenanceWorkOrderSchema,
  createTimeEntrySchema,
  incidentStatusTransitionSchema,
  isValidIncidentTransition,
  isValidChangeTransition,
  INCIDENT_STATUS_TRANSITIONS,
  CHANGE_STATUS_TRANSITIONS,
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
  countEnterpriseIncidents,
  countEnterpriseAssets,
  countMaintenanceWorkOrders,
  parseEnterpriseListOptions,
  type ListOptions,
  type PaginatedResult,
} from '@/modules/enterprise/enterprise.repository'
import { paginationMeta } from '@/lib/api/pagination'

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

async function assertCompanyRecord<T extends { id: string }>(
  loader: Promise<T | null>,
  message = 'Selected enterprise record was not found in this workspace.'
) {
  const record = await loader
  if (!record) throw notFound(message)
  return record
}

async function nextSequenceNumber(tx: Prisma.TransactionClient, companyId: string, prefix: 'INC' | 'MWO' | 'CHG') {
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
  ] = await prisma.$transaction([
    prisma.enterpriseDepartment.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        _count: { select: { assets: true, incidents: true, maintenanceOrders: true } },
      },
    }),
    prisma.enterpriseTeam.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        department: { select: { id: true, name: true, code: true } },
        members: { select: { id: true } },
        _count: { select: { assignedIncidents: true, assignedAssets: true, maintenanceOrders: true } },
      },
    }),
    prisma.enterpriseAssetCategory.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: [{ assetType: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, assetType: true, status: true, riskWeight: true },
    }),
    prisma.enterpriseAsset.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ riskScore: 'desc' }, { nextMaintenanceAt: 'asc' }, { createdAt: 'desc' }],
      take: 12,
      select: {
        id: true,
        name: true,
        assetTag: true,
        healthScore: true,
        riskScore: true,
        nextMaintenanceAt: true,
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.enterpriseIncident.findMany({
      where: { companyId },
      orderBy: [{ createdAt: 'desc' }],
      take: 12,
      select: {
        id: true,
        incidentNumber: true,
        title: true,
        type: true,
        priority: true,
        severity: true,
        status: true,
        createdAt: true,
        resolutionDueAt: true,
        assignedTeam: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.enterpriseMaintenanceWorkOrder.findMany({
      where: { companyId },
      orderBy: [{ dueAt: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
      take: 12,
      select: {
        id: true,
        workOrderNumber: true,
        type: true,
        priority: true,
        status: true,
        dueAt: true,
        asset: { select: { id: true, name: true, assetTag: true } },
      },
    }),
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
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      },
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

export async function listAssets(user: SessionUser, options?: ListOptions): Promise<PaginatedResult<unknown>> {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'read', 'asset', { companyId })
  const filters = options ?? {}
  const [data, total] = await Promise.all([
    listEnterpriseAssets(companyId, filters),
    countEnterpriseAssets(companyId, filters),
  ])
  const page = (filters.skip ?? 0) / Math.max(filters.take ?? 50, 1) + 1
  return { data, pagination: paginationMeta({ page, pageSize: filters.take ?? 50, total }) }
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

    await recordEnterpriseAuditTx(tx, {
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

export async function listIncidents(user: SessionUser, searchParams?: URLSearchParams): Promise<PaginatedResult<unknown>> {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'read', 'incident', { companyId })
  const { pagination, filters } = searchParams
    ? parseEnterpriseListOptions(searchParams)
    : { pagination: { skip: 0, page: 1, pageSize: 50, total: 0, pageCount: 0 }, filters: {} }
  const [data, total] = await Promise.all([
    listEnterpriseIncidents(companyId, { ...filters, skip: pagination.skip, take: pagination.pageSize }),
    countEnterpriseIncidents(companyId, filters),
  ])
  return { data, pagination: paginationMeta({ ...pagination, total }) }
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

    await recordEnterpriseAuditTx(tx, {
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
    await recordEnterpriseAuditTx(tx, {
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

export async function listMaintenance(user: SessionUser, searchParams?: URLSearchParams): Promise<PaginatedResult<unknown>> {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'read', 'maintenance', { companyId })
  const { pagination, filters } = searchParams
    ? parseEnterpriseListOptions(searchParams)
    : { pagination: { skip: 0, page: 1, pageSize: 50, total: 0, pageCount: 0 }, filters: {} }
  const [data, total] = await Promise.all([
    listMaintenanceWorkOrders(companyId, { ...filters, skip: pagination.skip, take: pagination.pageSize }),
    countMaintenanceWorkOrders(companyId, filters),
  ])
  return { data, pagination: paginationMeta({ ...pagination, total }) }
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
    await recordEnterpriseAuditTx(tx, {
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

    await recordEnterpriseAuditTx(tx, {
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

// ── Problem Management ──────────────────────────────────────────

export async function listProblems(user: SessionUser) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'read', 'incident', { companyId })
  return prisma.enterpriseProblem.findMany({
    where: { companyId },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      incidents: { select: { id: true, incidentNumber: true, title: true, status: true }, take: 20 },
    },
  })
}

export async function getProblem(user: SessionUser, id: string) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'read', 'incident', { companyId })
  const problem = await prisma.enterpriseProblem.findFirst({
    where: { id, companyId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      incidents: { select: { id: true, incidentNumber: true, title: true, status: true, createdAt: true, priority: true } },
    },
  })
  if (!problem) throw notFound('Problem record not found.')
  return problem
}

export async function createProblem(user: SessionUser, rawInput: unknown, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'create', 'incident', { companyId })
  const input = createEnterpriseProblemSchema.parse(rawInput)

  if (input.assignedToId) {
    await assertCompanyRecord(prisma.user.findFirst({ where: { id: input.assignedToId, companyId } }), 'Assignee not found.')
  }

  const problem = await enterpriseRepositoryTransaction(async (tx) => {
    const created = await tx.enterpriseProblem.create({
      data: {
        companyId,
        title: input.title,
        description: input.description || null,
        category: input.category,
        priority: input.priority.toUpperCase(),
        assignedToId: input.assignedToId || null,
        rootCause: input.rootCause || null,
        workaround: input.workaround || null,
        firstOccurrence: new Date(),
      },
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
    })

    if (input.incidentId) {
      await tx.enterpriseIncident.update({
        where: { id: input.incidentId, companyId },
        data: { problemId: created.id },
      })
    }

    await recordEnterpriseAuditTx(tx, {
      companyId,
      actorId: user.id,
      action: 'enterprise.problem.created',
      entityType: 'enterprise_problem',
      entityId: created.id,
      after: created,
      requestId,
    })
    return created
  })

  await publishDomainEvent({
    type: 'enterprise.incident.updated',
    companyId,
    actorId: user.id,
    entityType: 'enterprise_problem',
    entityId: problem.id,
    action: 'Enterprise problem created',
    payload: { problem },
    after: problem,
  })

  return problem
}

export async function updateProblem(user: SessionUser, id: string, rawInput: unknown, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  const input = updateEnterpriseProblemSchema.parse(rawInput)
  const existing = await prisma.enterpriseProblem.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Problem record not found.')
  assertCan(user, 'update', 'incident', { companyId })

  const updated = await enterpriseRepositoryTransaction(async (tx) => {
    const next = await tx.enterpriseProblem.update({
      where: { id },
      data: {
        status: input.status?.toUpperCase(),
        rootCause: input.rootCause === undefined ? undefined : input.rootCause,
        workaround: input.workaround === undefined ? undefined : input.workaround,
        permanentFix: input.permanentFix === undefined ? undefined : input.permanentFix,
        resolutionDate: input.resolutionDate ? new Date(input.resolutionDate) : undefined,
        knownError: input.knownError === undefined ? undefined : input.knownError,
        assignedToId: input.assignedToId === undefined ? undefined : input.assignedToId,
        ...(input.status?.toUpperCase() === 'RESOLVED' ? { resolutionDate: new Date() } : {}),
      },
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
    })
    await recordEnterpriseAuditTx(tx, {
      companyId,
      actorId: user.id,
      action: 'enterprise.problem.updated',
      entityType: 'enterprise_problem',
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
    entityType: 'enterprise_problem',
    entityId: id,
    action: 'Enterprise problem updated',
    payload: { problem: updated },
    before: existing,
    after: updated,
  })

  return updated
}

// ── Change Management ────────────────────────────────────────────

export async function listChanges(user: SessionUser) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'read', 'incident', { companyId })
  return prisma.enterpriseChange.findMany({
    where: { companyId },
    orderBy: [{ scheduledStart: 'asc' }, { priority: 'asc' }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      incidents: { select: { id: true, incidentNumber: true, title: true, status: true }, take: 20 },
    },
  })
}

export async function getChange(user: SessionUser, id: string) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'read', 'incident', { companyId })
  const change = await prisma.enterpriseChange.findFirst({
    where: { id, companyId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      incidents: { select: { id: true, incidentNumber: true, title: true, status: true } },
    },
  })
  if (!change) throw notFound('Change record not found.')
  return change
}

export async function createChange(user: SessionUser, rawInput: unknown, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  assertCan(user, 'create', 'incident', { companyId })
  const input = createEnterpriseChangeSchema.parse(rawInput)

  const change = await enterpriseRepositoryTransaction(async (tx) => {
    const changeNumber = await nextSequenceNumber(tx, companyId, 'INC')
    const created = await tx.enterpriseChange.create({
      data: {
        companyId,
        changeNumber,
        title: input.title,
        description: input.description || null,
        type: input.type.toUpperCase(),
        priority: input.priority.toUpperCase(),
        riskScore: input.riskScore,
        impact: input.impact.toUpperCase(),
        justification: input.justification || null,
        rollbackPlan: input.rollbackPlan as any || undefined,
        implementationPlan: input.implementationPlan as any || undefined,
        scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : null,
        scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : null,
        createdById: user.id,
        auditTrail: [{ at: new Date().toISOString(), actorId: user.id, action: 'created' }],
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    })
    await recordEnterpriseAuditTx(tx, {
      companyId,
      actorId: user.id,
      action: 'enterprise.change.created',
      entityType: 'enterprise_change',
      entityId: created.id,
      after: created,
      requestId,
    })
    return created
  })

  await publishDomainEvent({
    type: 'enterprise.incident.updated',
    companyId,
    actorId: user.id,
    entityType: 'enterprise_change',
    entityId: change.id,
    action: 'Enterprise change created',
    payload: { change },
    after: change,
  })

  return change
}

export async function updateChange(user: SessionUser, id: string, rawInput: unknown, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  const input = updateEnterpriseChangeSchema.parse(rawInput)
  const existing = await prisma.enterpriseChange.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Change record not found.')
  assertCan(user, 'update', 'incident', { companyId })

  if (input.status && !isValidChangeTransition(existing.status, input.status.toUpperCase())) {
    throw badRequest(`Invalid status transition: ${existing.status} → ${input.status}. Allowed: ${CHANGE_STATUS_TRANSITIONS[existing.status]?.join(', ') || 'none'}`)
  }

  const updated = await enterpriseRepositoryTransaction(async (tx) => {
    const next = await tx.enterpriseChange.update({
      where: { id },
      data: {
        status: input.status?.toUpperCase(),
        riskScore: input.riskScore,
        justification: input.justification === undefined ? undefined : input.justification,
        rollbackPlan: input.rollbackPlan as any || undefined,
        implementationPlan: input.implementationPlan as any || undefined,
        scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : undefined,
        scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : undefined,
        actualStart: input.actualStart ? new Date(input.actualStart) : undefined,
        actualEnd: input.actualEnd ? new Date(input.actualEnd) : undefined,
        cabMeetingId: input.cabMeetingId === undefined ? undefined : input.cabMeetingId,
        approvalState: input.approvalState?.toUpperCase(),
        auditTrail: [
          ...(Array.isArray(existing.auditTrail) ? existing.auditTrail : []),
          { at: new Date().toISOString(), actorId: user.id, action: 'updated', status: input.status },
        ] as Prisma.InputJsonValue,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    })
    await recordEnterpriseAuditTx(tx, {
      companyId,
      actorId: user.id,
      action: 'enterprise.change.updated',
      entityType: 'enterprise_change',
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
    entityType: 'enterprise_change',
    entityId: id,
    action: 'Enterprise change updated',
    payload: { change: updated },
    before: existing,
    after: updated,
  })

  return updated
}

// ── Change Management Actions ──────────────────────────────────────

export async function submitChangeForCAB(user: SessionUser, id: string, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  const existing = await prisma.enterpriseChange.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Change record not found.')

  const updated = await updateChange(user, id, { status: 'PENDING_CAB' }, requestId)

  const { startApprovalWorkflow } = await import('@/modules/enterprise/enterprise-approval-engine')
  await enterpriseRepositoryTransaction(async (tx) => {
    await startApprovalWorkflow(tx, {
      companyId,
      entityType: 'enterprise_change',
      entityId: id,
      requestedById: user.id,
      steps: [
        {
          stepIndex: 0,
          stepType: 'SINGLE',
          label: 'CAB Approval',
          assigneeId: null,
          teamId: null,
          order: 0,
          timeoutHours: 48,
        },
      ],
    })
  })

  return updated
}

export async function cabApproveChange(user: SessionUser, id: string, rawInput: { meetingId?: string; comments?: string; stepId?: string }, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  const existing = await prisma.enterpriseChange.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Change record not found.')
  assertCan(user, 'update', 'incident', { companyId })

  if (existing.status !== 'PENDING_CAB') throw badRequest('Change is not pending CAB approval.')

  const { approveStep } = await import('@/modules/enterprise/enterprise-approval-engine')

  const updated = await enterpriseRepositoryTransaction(async (tx) => {
    if (rawInput.stepId) {
      const result = await approveStep(tx, {
        companyId,
        stepId: rawInput.stepId,
        decidedById: user.id,
        comments: rawInput.comments,
      })
      if (!result.approved) throw badRequest('Workflow not approved.')
    }

    const next = await tx.enterpriseChange.update({
      where: { id },
      data: {
        approvalState: 'APPROVED',
        cabMeetingId: rawInput.meetingId || existing.cabMeetingId,
        status: 'SCHEDULED',
        auditTrail: [
          ...(Array.isArray(existing.auditTrail) ? existing.auditTrail : []),
          { at: new Date().toISOString(), actorId: user.id, action: 'cab_approved', comments: rawInput.comments },
        ] as Prisma.InputJsonValue,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    })
    await recordEnterpriseAuditTx(tx, {
      companyId, actorId: user.id, action: 'enterprise.change.cab_approved',
      entityType: 'enterprise_change', entityId: id, before: { status: existing.status, approvalState: existing.approvalState }, after: { status: next.status, approvalState: next.approvalState }, requestId,
    })
    return next
  })

  await publishDomainEvent({
    type: 'enterprise.incident.updated', companyId, actorId: user.id,
    entityType: 'enterprise_change', entityId: id,
    action: 'Enterprise change CAB approved', payload: { change: updated },
    before: existing, after: updated,
  })

  return updated
}

export async function cabRejectChange(user: SessionUser, id: string, rawInput: { reason?: string; stepId?: string }, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  const existing = await prisma.enterpriseChange.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Change record not found.')
  assertCan(user, 'update', 'incident', { companyId })

  if (existing.status !== 'PENDING_CAB') throw badRequest('Change is not pending CAB approval.')

  const { rejectStep } = await import('@/modules/enterprise/enterprise-approval-engine')

  const updated = await enterpriseRepositoryTransaction(async (tx) => {
    if (rawInput.stepId) {
      await rejectStep(tx, {
        companyId,
        stepId: rawInput.stepId,
        decidedById: user.id,
        comments: rawInput.reason,
      })
    }

    const next = await tx.enterpriseChange.update({
      where: { id },
      data: {
        approvalState: 'REJECTED',
        status: 'DRAFT',
        auditTrail: [
          ...(Array.isArray(existing.auditTrail) ? existing.auditTrail : []),
          { at: new Date().toISOString(), actorId: user.id, action: 'cab_rejected', reason: rawInput.reason },
        ] as Prisma.InputJsonValue,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    })
    await recordEnterpriseAuditTx(tx, {
      companyId, actorId: user.id, action: 'enterprise.change.cab_rejected',
      entityType: 'enterprise_change', entityId: id, before: { status: existing.status, approvalState: existing.approvalState }, after: { status: next.status, approvalState: next.approvalState }, requestId,
    })
    return next
  })

  await publishDomainEvent({
    type: 'enterprise.incident.updated', companyId, actorId: user.id,
    entityType: 'enterprise_change', entityId: id,
    action: 'Enterprise change CAB rejected', payload: { change: updated },
    before: existing, after: updated,
  })

  return updated
}

export async function implementChange(user: SessionUser, id: string, requestId?: string) {
  return updateChange(user, id, { status: 'IMPLEMENTING' }, requestId)
}

export async function rollbackChange(user: SessionUser, id: string, rawInput: { reason?: string }, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  const existing = await prisma.enterpriseChange.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Change record not found.')
  assertCan(user, 'update', 'incident', { companyId })

  if (existing.status !== 'IMPLEMENTING') throw badRequest('Only implementing changes can be rolled back.')

  const updated = await enterpriseRepositoryTransaction(async (tx) => {
    const next = await tx.enterpriseChange.update({
      where: { id },
      data: {
        status: 'ROLLED_BACK',
        actualEnd: new Date(),
        auditTrail: [
          ...(Array.isArray(existing.auditTrail) ? existing.auditTrail : []),
          { at: new Date().toISOString(), actorId: user.id, action: 'rolled_back', reason: rawInput.reason },
        ] as Prisma.InputJsonValue,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    })
    await recordEnterpriseAuditTx(tx, {
      companyId, actorId: user.id, action: 'enterprise.change.rolled_back',
      entityType: 'enterprise_change', entityId: id, before: { status: existing.status }, after: { status: next.status }, requestId,
    })
    return next
  })

  await publishDomainEvent({
    type: 'enterprise.incident.updated', companyId, actorId: user.id,
    entityType: 'enterprise_change', entityId: id,
    action: 'Enterprise change rolled back', payload: { change: updated },
    before: existing, after: updated,
  })

  return updated
}

// ── Incident Status State Machine ──────────────────────────────────

export async function updateIncidentStatus(user: SessionUser, id: string, rawInput: unknown, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  const input = incidentStatusTransitionSchema.parse(rawInput)
  const existing = await prisma.enterpriseIncident.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Incident not found.')
  assertCan(user, 'update', 'incident', { companyId, assigneeId: existing.assignedToId })

  if (!isValidIncidentTransition(existing.status, input.status)) {
    throw badRequest(`Invalid status transition: ${existing.status} → ${input.status}. Allowed: ${INCIDENT_STATUS_TRANSITIONS[existing.status]?.join(', ') || 'none'}`)
  }

  const resolved = input.status === 'RESOLVED'
  const closed = input.status === 'CLOSED'

  const updated = await enterpriseRepositoryTransaction(async (tx) => {
    if (closed && !existing.resolvedAt && !input.resolution) {
      throw badRequest('Incident must have a resolution before closing.')
    }

    const next = await tx.enterpriseIncident.update({
      where: { id },
      data: {
        status: input.status,
        firstRespondedAt: existing.firstRespondedAt ?? (resolved || closed ? new Date() : undefined),
        resolvedAt: resolved ? new Date() : (input.status === 'IN_PROGRESS' ? null : undefined),
        closedAt: closed ? new Date() : undefined,
        resolution: input.resolution === undefined ? undefined : input.resolution,
        rootCause: input.rootCause === undefined ? undefined : input.rootCause,
        escalationState: resolved || closed ? 'NONE' : undefined,
        auditTrail: [
          ...(Array.isArray(existing.auditTrail) ? existing.auditTrail : []),
          { at: new Date().toISOString(), actorId: user.id, action: 'status_change', from: existing.status, to: input.status },
        ] as Prisma.InputJsonValue,
      },
      include: { assignedTo: { select: { id: true, name: true, email: true } }, slaPolicy: true },
    })
    await recordEnterpriseAuditTx(tx, {
      companyId,
      actorId: user.id,
      action: 'enterprise.incident.status_changed',
      entityType: 'enterprise_incident',
      entityId: id,
      before: { status: existing.status },
      after: { status: input.status },
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
    action: `Incident status changed: ${existing.status} → ${input.status}`,
    payload: { incident: updated, previousStatus: existing.status, newStatus: input.status },
    before: existing,
    after: updated,
  })

  return updated
}

// ── Time Entry ────────────────────────────────────────────────────

export async function listTimeEntries(user: SessionUser, incidentId: string) {
  const companyId = requireEnterpriseCompany(user)
  await assertCompanyRecord(prisma.enterpriseIncident.findFirst({ where: { id: incidentId, companyId } }), 'Incident not found.')
  return prisma.enterpriseIncidentTimeEntry.findMany({
    where: { incidentId, companyId },
    orderBy: { entryDate: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
}

export async function createTimeEntry(user: SessionUser, incidentId: string, rawInput: unknown, requestId?: string) {
  const companyId = requireEnterpriseCompany(user)
  const input = createTimeEntrySchema.parse(rawInput)
  await assertCompanyRecord(prisma.enterpriseIncident.findFirst({ where: { id: incidentId, companyId } }), 'Incident not found.')

  const entry = await enterpriseRepositoryTransaction(async (tx) => {
    const created = await tx.enterpriseIncidentTimeEntry.create({
      data: {
        companyId,
        incidentId,
        userId: user.id,
        minutes: input.minutes,
        billable: input.billable,
        description: input.description || null,
        entryDate: input.entryDate ? new Date(input.entryDate) : new Date(),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    await recordEnterpriseAuditTx(tx, {
      companyId,
      actorId: user.id,
      action: 'enterprise.time_entry.created',
      entityType: 'enterprise_incident_time_entry',
      entityId: created.id,
      after: created,
      requestId,
    })
    return created
  })

  return entry
}

export async function deleteTimeEntry(user: SessionUser, incidentId: string, entryId: string) {
  const companyId = requireEnterpriseCompany(user)
  const entry = await prisma.enterpriseIncidentTimeEntry.findFirst({
    where: { id: entryId, incidentId, companyId },
  })
  if (!entry) throw notFound('Time entry not found.')
  if (entry.userId !== user.id && !canManageWorkspace(user)) throw forbidden('You can only delete your own time entries.')

  await prisma.enterpriseIncidentTimeEntry.delete({ where: { id: entryId } })
  return { deleted: true }
}
