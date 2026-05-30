import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { badRequest } from '@/modules/shared/errors'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { logger } from '@/modules/shared/logger'
import type { SessionUser } from '@/modules/shared/session'

export type ReportType = 'incident_summary' | 'sla_compliance' | 'asset_inventory' | 'change_summary' | 'csat_summary' | 'problem_analysis'

interface ReportResult {
  type: ReportType
  generatedAt: string
  companyId: string
  data: Record<string, unknown>
}

function company(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found.')
  return user.companyId
}

// ── Report Generation ────────────────────────────────────────────

export async function generateReport(
  user: SessionUser,
  reportType: ReportType,
  filters?: { departmentId?: string; from?: string; to?: string }
): Promise<ReportResult> {
  const cid = company(user)
  const generatedAt = new Date().toISOString()

  switch (reportType) {
    case 'incident_summary':
      return { type: reportType, generatedAt, companyId: cid, data: await buildIncidentSummary(cid, filters) }
    case 'sla_compliance':
      return { type: reportType, generatedAt, companyId: cid, data: await buildSlaCompliance(cid, filters) }
    case 'asset_inventory':
      return { type: reportType, generatedAt, companyId: cid, data: await buildAssetInventory(cid, filters) }
    case 'change_summary':
      return { type: reportType, generatedAt, companyId: cid, data: await buildChangeSummary(cid, filters) }
    case 'csat_summary':
      return { type: reportType, generatedAt, companyId: cid, data: await buildCsatReport(cid, filters) }
    case 'problem_analysis':
      return { type: reportType, generatedAt, companyId: cid, data: await buildProblemAnalysis(cid, filters) }
    default:
      throw badRequest(`Unknown report type: ${reportType}`)
  }
}

async function buildIncidentSummary(cid: string, filters?: { departmentId?: string; from?: string; to?: string }) {
  const where: any = { companyId: cid }
  if (filters?.departmentId) where.departmentId = filters.departmentId
  if (filters?.from) where.createdAt = { ...(where.createdAt || {}), gte: new Date(filters.from) }
  if (filters?.to) where.createdAt = { ...(where.createdAt || {}), lte: new Date(filters.to) }

  const [total, byStatus, byPriority, byDepartment, recent] = await Promise.all([
    enterpriseRepositoryPrisma.enterpriseIncident.count({ where }),
    enterpriseRepositoryPrisma.enterpriseIncident.groupBy({ by: ['status'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseIncident.groupBy({ by: ['priority'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseIncident.groupBy({ by: ['departmentId'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseIncident.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 20,
      select: { id: true, incidentNumber: true, title: true, status: true, priority: true, createdAt: true },
    }),
  ])

  return { total, byStatus, byPriority, byDepartment, recent }
}

async function buildSlaCompliance(cid: string, filters?: { departmentId?: string }) {
  const where: any = { companyId: cid, slaPolicyId: { not: null } }
  if (filters?.departmentId) where.departmentId = filters.departmentId

  const [total, breached, byPolicy] = await Promise.all([
    enterpriseRepositoryPrisma.enterpriseIncident.count({ where }),
    enterpriseRepositoryPrisma.enterpriseIncident.count({
      where: { ...where, responseDueAt: { lte: new Date() }, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } },
    }),
    enterpriseRepositoryPrisma.enterpriseSlaPolicy.findMany({
      where: { companyId: cid, status: 'ACTIVE' },
      select: { id: true, name: true, priority: true, responseMinutes: true, resolutionMinutes: true },
    }),
  ])

  return { totalSlaIncidents: total, breached, complianceRate: total > 0 ? Math.round(((total - breached) / total) * 100) : 100, policies: byPolicy }
}

async function buildAssetInventory(cid: string, filters?: { departmentId?: string }) {
  const where: any = { companyId: cid, deletedAt: null }
  if (filters?.departmentId) where.departmentId = filters.departmentId

  const [total, byCategory, byLifecycle, byDepartment, totalValue, totalBookValue, activeLeases] = await Promise.all([
    enterpriseRepositoryPrisma.enterpriseAsset.count({ where }),
    enterpriseRepositoryPrisma.enterpriseAsset.groupBy({ by: ['categoryId'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseAsset.groupBy({ by: ['lifecycleState'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseAsset.groupBy({ by: ['departmentId'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseAsset.aggregate({ where, _sum: { purchaseCost: true } }),
    enterpriseRepositoryPrisma.enterpriseAsset.aggregate({ where, _sum: { currentBookValue: true } }),
    enterpriseRepositoryPrisma.enterpriseAssetLease.count({ where: { companyId: cid, status: 'ACTIVE' } }),
  ])

  return { total, byCategory, byLifecycle, byDepartment, totalValue: totalValue._sum.purchaseCost, totalBookValue: totalBookValue._sum.currentBookValue, activeLeases }
}

async function buildChangeSummary(cid: string, filters?: { from?: string; to?: string }) {
  const where: any = { companyId: cid }
  if (filters?.from) where.createdAt = { ...(where.createdAt || {}), gte: new Date(filters.from) }
  if (filters?.to) where.createdAt = { ...(where.createdAt || {}), lte: new Date(filters.to) }

  const [total, byStatus, byType, byPriority, recent] = await Promise.all([
    enterpriseRepositoryPrisma.enterpriseChange.count({ where }),
    enterpriseRepositoryPrisma.enterpriseChange.groupBy({ by: ['status'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseChange.groupBy({ by: ['type'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseChange.groupBy({ by: ['priority'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseChange.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 20,
      select: { id: true, changeNumber: true, title: true, status: true, type: true, priority: true, createdAt: true },
    }),
  ])

  return { total, byStatus, byType, byPriority, recent }
}

async function buildCsatReport(cid: string, filters?: { departmentId?: string }) {
  const where: any = { companyId: cid }
  if (filters?.departmentId) where.departmentId = filters.departmentId

  const incidents = await enterpriseRepositoryPrisma.enterpriseIncident.findMany({
    where,
    select: { id: true, incidentNumber: true, departmentId: true, metadata: true, resolvedAt: true },
    take: 1000,
  })

  const scores = incidents
    .map((i) => { const m = i.metadata as Record<string, unknown> | null; return m?.csatScore ? Number(m.csatScore) : null })
    .filter((s): s is number => s !== null)

  return {
    total: scores.length,
    average: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
    distribution: { 1: scores.filter((s) => s === 1).length, 2: scores.filter((s) => s === 2).length, 3: scores.filter((s) => s === 3).length, 4: scores.filter((s) => s === 4).length, 5: scores.filter((s) => s === 5).length },
  }
}

async function buildProblemAnalysis(cid: string, filters?: { from?: string; to?: string }) {
  const where: any = { companyId: cid }
  if (filters?.from) where.createdAt = { ...(where.createdAt || {}), gte: new Date(filters.from) }
  if (filters?.to) where.createdAt = { ...(where.createdAt || {}), lte: new Date(filters.to) }

  const [total, byCategory, byStatus, byPriority, knownErrors, resolved] = await Promise.all([
    enterpriseRepositoryPrisma.enterpriseProblem.count({ where }),
    enterpriseRepositoryPrisma.enterpriseProblem.groupBy({ by: ['category'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseProblem.groupBy({ by: ['status'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseProblem.groupBy({ by: ['priority'], where, _count: true }),
    enterpriseRepositoryPrisma.enterpriseProblem.count({ where: { ...where, knownError: true } }),
    enterpriseRepositoryPrisma.enterpriseProblem.count({ where: { ...where, status: 'RESOLVED' } }),
  ])

  return { total, byCategory, byStatus, byPriority, knownErrors, resolved, resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0 }
}

// ── Schedule Management ──────────────────────────────────────────

export async function listReportSchedules(user: SessionUser) {
  const prefs = await enterpriseRepositoryPrisma.notificationPreference.findFirst({
    where: { userId: user.id },
  })
  const muted = (prefs?.mutedEntities as Record<string, unknown>) || {}
  return (muted.enterpriseReportSchedules as Record<string, unknown>[]) || []
}

export async function createReportSchedule(
  user: SessionUser,
  input: {
    name: string
    reportType: ReportType
    frequency: string
    emails: string[]
    filters?: Record<string, unknown>
  }
) {
  const cid = company(user)

  let prefs = await enterpriseRepositoryPrisma.notificationPreference.findFirst({
    where: { userId: user.id },
  })
  if (!prefs) {
    prefs = await enterpriseRepositoryPrisma.notificationPreference.create({
      data: { userId: user.id, mutedEntities: { enterpriseReportSchedules: [] } },
    })
  }

  const existing = (prefs.mutedEntities as Record<string, unknown>) || {}
  const schedules = (existing.enterpriseReportSchedules as Record<string, unknown>[]) || []

  const schedule = {
    id: `sched_${Date.now()}`,
    name: input.name,
    reportType: input.reportType,
    frequency: input.frequency,
    emails: input.emails,
    filters: input.filters || {},
    isActive: true,
    lastRunAt: null,
    createdAt: new Date().toISOString(),
  }

  schedules.push(schedule)

  await enterpriseRepositoryPrisma.notificationPreference.update({
    where: { id: prefs.id },
    data: { mutedEntities: { ...existing, enterpriseReportSchedules: schedules } as any },
  })

  return schedule
}

export async function deleteReportSchedule(user: SessionUser, scheduleId: string) {
  const prefs = await enterpriseRepositoryPrisma.notificationPreference.findFirst({
    where: { userId: user.id },
  })
  if (!prefs) throw Object.assign(new Error('No report schedules found.'), { status: 404 })

  const existing = (prefs.mutedEntities as Record<string, unknown>) || {}
  const schedules = (existing.enterpriseReportSchedules as Record<string, unknown>[]) || []
  const filtered = schedules.filter((s: any) => s.id !== scheduleId)

  if (filtered.length === schedules.length) {
    throw Object.assign(new Error('Report schedule not found.'), { status: 404 })
  }

  await enterpriseRepositoryPrisma.notificationPreference.update({
    where: { id: prefs.id },
    data: { mutedEntities: { ...existing, enterpriseReportSchedules: filtered } as any },
  })

  return { deleted: true }
}
