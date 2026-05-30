import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { parsePaginationSearchParams, paginationMeta, type PaginationInput } from '@/lib/api/pagination'

export type ListOptions = {
  take?: number
  skip?: number
  status?: string | null
  priority?: string | null
  departmentId?: string | null
  teamId?: string | null
  assigneeId?: string | null
  search?: string | null
  from?: string | null
  to?: string | null
  sort?: string
  order?: 'asc' | 'desc'
}

export type PaginatedResult<T> = {
  data: T[]
  pagination: { page: number; pageSize: number; total: number; pageCount: number }
}

export const enterpriseDashboardSelect = {
  enterpriseDepartments: { where: { deletedAt: null }, select: { id: true, name: true, code: true, status: true } },
  enterpriseTeams: { where: { deletedAt: null }, select: { id: true, name: true, code: true, status: true, workloadCapacity: true } },
} satisfies Prisma.CompanySelect

function buildWhere(companyId: string, options: ListOptions): Record<string, unknown> {
  const where: Record<string, unknown> = { companyId }
  if (options.status) where.status = options.status
  if (options.priority) where.priority = options.priority
  if (options.departmentId) where.departmentId = options.departmentId
  if (options.teamId) where.assignedTeamId = options.teamId
  if (options.assigneeId) where.assignedToId = options.assigneeId
  if (options.search) where.title = { contains: options.search, mode: 'insensitive' }
  if (options.from || options.to) {
    const createdAt: Record<string, Date> = {}
    if (options.from) createdAt.gte = new Date(options.from)
    if (options.to) createdAt.lte = new Date(options.to)
    where.createdAt = createdAt
  }
  return where
}

function buildOrderBy(options: ListOptions): Record<string, 'asc' | 'desc'>[] {
  const allowedSorts: Record<string, string> = {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    priority: 'priority',
    severity: 'severity',
    status: 'status',
    resolutionDueAt: 'resolutionDueAt',
    responseDueAt: 'responseDueAt',
  }
  const field = allowedSorts[options.sort ?? 'createdAt'] || 'createdAt'
  const dir = options.order === 'asc' ? 'asc' : 'desc'
  if (field === 'priority') return [{ priority: dir }, { createdAt: 'desc' as const }]
  return [{ [field]: dir } as Record<string, 'asc' | 'desc'>]
}

function parseOptions(searchParams: URLSearchParams): ListOptions {
  return {
    status: searchParams.get('status'),
    priority: searchParams.get('priority'),
    departmentId: searchParams.get('departmentId'),
    teamId: searchParams.get('teamId'),
    assigneeId: searchParams.get('assigneeId'),
    search: searchParams.get('search'),
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    sort: searchParams.get('sort') || undefined,
    order: (searchParams.get('order') as 'asc' | 'desc') || undefined,
  }
}

export function parseEnterpriseListOptions(searchParams: URLSearchParams): { pagination: PaginationInput; filters: ListOptions } {
  return {
    pagination: parsePaginationSearchParams(searchParams),
    filters: { ...parseOptions(searchParams), deletedAt: null },
  }
}

export function listEnterpriseDepartments(companyId: string) {
  return prisma.enterpriseDepartment.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ name: 'asc' }],
    include: {
      manager: { select: { id: true, name: true, email: true } },
      teams: { where: { deletedAt: null }, select: { id: true, name: true, code: true, status: true } },
      _count: { select: { assets: true, incidents: true, maintenanceOrders: true } },
    },
  })
}

export function listEnterpriseTeams(companyId: string) {
  return prisma.enterpriseTeam.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    include: {
      department: { select: { id: true, name: true, code: true } },
      leader: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { assignedIncidents: true, assignedAssets: true, maintenanceOrders: true } },
    },
  })
}

export function listEnterpriseAssetCategories(companyId: string) {
  return prisma.enterpriseAssetCategory.findMany({
    where: { companyId, status: 'ACTIVE' },
    orderBy: [{ assetType: 'asc' }, { name: 'asc' }],
  })
}

export function listEnterpriseAssets(companyId: string, options: ListOptions = {}) {
  const where = { ...buildWhere(companyId, options), deletedAt: null }
  return prisma.enterpriseAsset.findMany({
    where,
    orderBy: [{ riskScore: 'desc' }, { nextMaintenanceAt: 'asc' }, { createdAt: 'desc' }],
    skip: options.skip,
    take: options.take ?? 50,
    include: {
      category: true,
      department: { select: { id: true, name: true, code: true } },
      assignedTeam: { select: { id: true, name: true, code: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      _count: { select: { incidents: true, maintenanceOrders: true } },
    },
  })
}

export function countEnterpriseAssets(companyId: string, options: ListOptions = {}) {
  const where = { ...buildWhere(companyId, options), deletedAt: null }
  return prisma.enterpriseAsset.count({ where })
}

export function listEnterpriseIncidents(companyId: string, options: ListOptions = {}) {
  const where = buildWhere(companyId, options)
  return prisma.enterpriseIncident.findMany({
    where,
    orderBy: buildOrderBy(options),
    skip: options.skip,
    take: options.take ?? 50,
    include: {
      department: { select: { id: true, name: true, code: true } },
      assignedTeam: { select: { id: true, name: true, code: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      asset: { select: { id: true, name: true, assetTag: true, operationalStatus: true } },
      slaPolicy: { select: { id: true, name: true, responseMinutes: true, resolutionMinutes: true } },
    },
  })
}

export function countEnterpriseIncidents(companyId: string, options: ListOptions = {}) {
  return prisma.enterpriseIncident.count({ where: buildWhere(companyId, options) })
}

export function listMaintenanceWorkOrders(companyId: string, options: ListOptions = {}) {
  const where = buildWhere(companyId, options)
  return prisma.enterpriseMaintenanceWorkOrder.findMany({
    where,
    orderBy: [{ dueAt: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
    skip: options.skip,
    take: options.take ?? 50,
    include: {
      asset: { select: { id: true, name: true, assetTag: true, healthScore: true, riskScore: true } },
      department: { select: { id: true, name: true, code: true } },
      assignedTeam: { select: { id: true, name: true, code: true } },
      assignedTechnician: { select: { id: true, name: true, email: true } },
      incident: { select: { id: true, incidentNumber: true, title: true } },
    },
  })
}

export function countMaintenanceWorkOrders(companyId: string, options: ListOptions = {}) {
  return prisma.enterpriseMaintenanceWorkOrder.count({ where: buildWhere(companyId, options) })
}

export function enterpriseRepositoryTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(callback)
}

export { prisma as enterpriseRepositoryPrisma }
