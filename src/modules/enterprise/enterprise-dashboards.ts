import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { badRequest } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'

function company(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found.')
  return user.companyId
}

export async function getExecutiveDashboard(user: SessionUser) {
  const cid = company(user)

  const [
    departmentCount,
    teamCount,
    totalIncidents,
    openIncidents,
    resolvedIncidents,
    breachedIncidents,
    totalAssets,
    inServiceAssets,
    retiredAssets,
    totalChanges,
    pendingChanges,
    completedChanges,
    totalProblems,
    openProblems,
    slaPolicies,
    vendors,
    contracts,
    pendingSteps,
  ] = await Promise.all([
    enterpriseRepositoryPrisma.enterpriseDepartment.count({ where: { companyId: cid } }),
    enterpriseRepositoryPrisma.enterpriseTeam.count({ where: { companyId: cid } }),
    enterpriseRepositoryPrisma.enterpriseIncident.count({ where: { companyId: cid } }),
    enterpriseRepositoryPrisma.enterpriseIncident.count({ where: { companyId: cid, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } } }),
    enterpriseRepositoryPrisma.enterpriseIncident.count({ where: { companyId: cid, status: 'RESOLVED' } }),
    enterpriseRepositoryPrisma.enterpriseIncident.count({
      where: { companyId: cid, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] }, responseDueAt: { lte: new Date() } },
    }),
    enterpriseRepositoryPrisma.enterpriseAsset.count({ where: { companyId: cid, deletedAt: null } }),
    enterpriseRepositoryPrisma.enterpriseAsset.count({ where: { companyId: cid, deletedAt: null, lifecycleState: 'IN_SERVICE' } }),
    enterpriseRepositoryPrisma.enterpriseAsset.count({ where: { companyId: cid, lifecycleState: 'RETIRED' } }),
    enterpriseRepositoryPrisma.enterpriseChange.count({ where: { companyId: cid } }),
    enterpriseRepositoryPrisma.enterpriseChange.count({ where: { companyId: cid, status: 'PENDING_CAB' } }),
    enterpriseRepositoryPrisma.enterpriseChange.count({ where: { companyId: cid, status: 'COMPLETED' } }),
    enterpriseRepositoryPrisma.enterpriseProblem.count({ where: { companyId: cid } }),
    enterpriseRepositoryPrisma.enterpriseProblem.count({ where: { companyId: cid, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    enterpriseRepositoryPrisma.enterpriseSlaPolicy.count({ where: { companyId: cid, status: 'ACTIVE' } }),
    enterpriseRepositoryPrisma.enterpriseVendor.count({ where: { companyId: cid } }),
    enterpriseRepositoryPrisma.enterpriseContract.count({ where: { companyId: cid, status: 'ACTIVE' } }),
    enterpriseRepositoryPrisma.enterpriseApprovalStep.count({ where: { decision: 'PENDING', companyId: cid } }),
  ])

  const recentIncidents = await enterpriseRepositoryPrisma.enterpriseIncident.findMany({
    where: { companyId: cid },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, incidentNumber: true, title: true, status: true, priority: true, createdAt: true },
  })

  const slaCompliance = totalIncidents > 0
    ? Math.round(((totalIncidents - breachedIncidents) / totalIncidents) * 100)
    : 100

  return {
    summary: {
      departments: departmentCount,
      teams: teamCount,
      totalIncidents,
      openIncidents,
      resolvedIncidents,
      breachedIncidents,
      slaCompliance,
      totalAssets,
      inServiceAssets,
      retiredAssets,
      totalChanges,
      pendingChanges,
      completedChanges,
      totalProblems,
      openProblems,
      slaPolicies,
      vendors,
      activeContracts: contracts,
      pendingApprovals: pendingSteps,
    },
    ratios: {
      resolutionRate: totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0,
      assetUtilization: totalAssets > 0 ? Math.round((inServiceAssets / totalAssets) * 100) : 0,
      changeSuccessRate: totalChanges > 0 ? Math.round((completedChanges / totalChanges) * 100) : 0,
    },
    recentIncidents,
  }
}

export async function getDepartmentDashboard(user: SessionUser, departmentId: string) {
  const cid = company(user)

  const dept = await enterpriseRepositoryPrisma.enterpriseDepartment.findFirst({
    where: { id: departmentId, companyId: cid },
  })
  if (!dept) throw Object.assign(new Error('Department not found.'), { status: 404 })

  const [teamCount, memberCount, deptIncidents, deptOpenIncidents, deptAssets, deptSlaPolicies] = await Promise.all([
    enterpriseRepositoryPrisma.enterpriseTeam.count({ where: { departmentId, companyId: cid } }),
    enterpriseRepositoryPrisma.enterpriseTeamMember.count({ where: { team: { departmentId, companyId: cid } } }),
    enterpriseRepositoryPrisma.enterpriseIncident.count({ where: { departmentId, companyId: cid } }),
    enterpriseRepositoryPrisma.enterpriseIncident.count({
      where: { departmentId, companyId: cid, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } },
    }),
    enterpriseRepositoryPrisma.enterpriseAsset.count({ where: { departmentId, companyId: cid, deletedAt: null } }),
    enterpriseRepositoryPrisma.enterpriseSlaPolicy.count({ where: { departmentId, companyId: cid, status: 'ACTIVE' } }),
  ])

  const recent = await enterpriseRepositoryPrisma.enterpriseIncident.findMany({
    where: { departmentId, companyId: cid },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, incidentNumber: true, title: true, status: true, priority: true, createdAt: true },
  })

  return {
    department: { id: dept.id, name: dept.name, code: dept.code },
    summary: {
      teams: teamCount,
      members: memberCount,
      totalIncidents: deptIncidents,
      openIncidents: deptOpenIncidents,
      totalAssets: deptAssets,
      slaPolicies: deptSlaPolicies,
    },
    recentIncidents: recent,
  }
}

export async function getTeamDashboard(user: SessionUser, teamId: string) {
  const cid = company(user)

  const team = await enterpriseRepositoryPrisma.enterpriseTeam.findFirst({
    where: { id: teamId, companyId: cid },
    include: {
      department: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  })
  if (!team) throw Object.assign(new Error('Team not found.'), { status: 404 })

  const [teamIncidents, teamOpenIncidents, teamWorkOrders, teamOpenWorkOrders] = await Promise.all([
    enterpriseRepositoryPrisma.enterpriseIncident.count({ where: { assignedTeamId: teamId, companyId: cid } }),
    enterpriseRepositoryPrisma.enterpriseIncident.count({
      where: { assignedTeamId: teamId, companyId: cid, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } },
    }),
    enterpriseRepositoryPrisma.enterpriseMaintenanceWorkOrder.count({ where: { assignedTeamId: teamId, companyId: cid } }),
    enterpriseRepositoryPrisma.enterpriseMaintenanceWorkOrder.count({
      where: { assignedTeamId: teamId, companyId: cid, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    }),
  ])

  const recent = await enterpriseRepositoryPrisma.enterpriseIncident.findMany({
    where: { assignedTeamId: teamId, companyId: cid },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, incidentNumber: true, title: true, status: true, priority: true },
  })

  return {
    team: { id: team.id, name: team.name, code: team.code, department: team.department, memberCount: team._count.members },
    summary: {
      totalIncidents: teamIncidents,
      openIncidents: teamOpenIncidents,
      totalWorkOrders: teamWorkOrders,
      openWorkOrders: teamOpenWorkOrders,
      workload: team.workloadCapacity > 0 ? Math.round((teamOpenIncidents / team.workloadCapacity) * 100) : 0,
    },
    recentIncidents: recent,
  }
}
