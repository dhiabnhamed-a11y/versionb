import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const enterpriseDashboardSelect = {
  enterpriseDepartments: { where: { deletedAt: null }, select: { id: true, name: true, code: true, status: true } },
  enterpriseTeams: { where: { deletedAt: null }, select: { id: true, name: true, code: true, status: true, workloadCapacity: true } },
} satisfies Prisma.CompanySelect

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

export function listEnterpriseAssets(companyId: string, options: { take?: number; status?: string | null } = {}) {
  return prisma.enterpriseAsset.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(options.status ? { operationalStatus: options.status } : {}),
    },
    orderBy: [{ riskScore: 'desc' }, { nextMaintenanceAt: 'asc' }, { createdAt: 'desc' }],
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

export function listEnterpriseIncidents(companyId: string, options: { take?: number; status?: string | null } = {}) {
  return prisma.enterpriseIncident.findMany({
    where: {
      companyId,
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: [{ priority: 'asc' }, { resolutionDueAt: 'asc' }, { createdAt: 'desc' }],
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

export function listMaintenanceWorkOrders(companyId: string, options: { take?: number; status?: string | null } = {}) {
  return prisma.enterpriseMaintenanceWorkOrder.findMany({
    where: {
      companyId,
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: [{ dueAt: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
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

export function enterpriseRepositoryTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(callback)
}

export { prisma as enterpriseRepositoryPrisma }
