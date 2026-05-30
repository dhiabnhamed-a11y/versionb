import { prisma } from '@/lib/db'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { logger } from '@/modules/shared/logger'

type AssignmentCandidate = {
  userId: string
  userName: string
  teamId: string
  teamName: string
  currentLoad: number
  capacity: number
  skillMatch: boolean
  isOnCall: boolean
  score: number
}

export async function autoAssignIncident(incidentId: string, companyId: string): Promise<{ assigned: boolean; to?: string; teamId?: string }> {
  const incident = await prisma.enterpriseIncident.findFirst({
    where: { id: incidentId, companyId },
    select: { id: true, incidentNumber: true, priority: true, type: true, departmentId: true, assignedTeamId: true, assignedToId: true },
  })

  if (!incident) return { assigned: false }
  if (incident.assignedToId) return { assigned: false, to: incident.assignedToId, teamId: incident.assignedTeamId ?? undefined }

  const departmentId = incident.departmentId
  if (!departmentId) return { assigned: false }

  const teams = await prisma.enterpriseTeam.findMany({
    where: {
      companyId,
      departmentId,
      status: 'ACTIVE',
      deletedAt: null,
    },
    include: {
      members: {
        where: { endsAt: null },
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: { assignedIncidents: { where: { status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } } } },
      },
    },
  })

  if (teams.length === 0) return { assigned: false }

  const candidates: AssignmentCandidate[] = []

  for (const team of teams) {
    const teamLoad = team._count.assignedIncidents
    const teamCapacity = team.workloadCapacity || 10
    const teamScore = Math.max(0, 1 - teamLoad / Math.max(teamCapacity, 1)) * 50

    for (const member of team.members) {
      const memberActiveCount = await prisma.enterpriseIncident.count({
        where: {
          companyId,
          assignedToId: member.userId,
          status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] },
        },
      })

      const memberCapacity = member.capacity || 100
      const loadRatio = memberCapacity > 0 ? memberActiveCount / memberCapacity : 1
      const availabilityScore = Math.max(0, 1 - loadRatio) * 30

      const priorityBonus = incident.priority === 'P1' ? 20 : incident.priority === 'P2' ? 10 : 0
      const onCallScore = member.isOnCall ? 15 : 0
      const rotationBonus = member.rotationGroup ? 5 : 0

      candidates.push({
        userId: member.userId,
        userName: member.user.name,
        teamId: team.id,
        teamName: team.name,
        currentLoad: memberActiveCount,
        capacity: memberCapacity,
        skillMatch: true,
        isOnCall: member.isOnCall,
        score: teamScore + availabilityScore + priorityBonus + onCallScore + rotationBonus,
      })
    }
  }

  if (candidates.length === 0) {
    const bestTeam = teams.sort((a, b) => (a._count.assignedIncidents / Math.max(a.workloadCapacity || 10, 1)) - (b._count.assignedIncidents / Math.max(b.workloadCapacity || 10, 1)))[0]
    if (bestTeam) {
      await assignToTeam(incident, bestTeam.id, companyId)
      return { assigned: true, teamId: bestTeam.id }
    }
    return { assigned: false }
  }

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  if (best.score < 10) {
    const leastLoadedTeam = teams.sort((a, b) => a._count.assignedIncidents - b._count.assignedIncidents)[0]
    await assignToTeam(incident, leastLoadedTeam.id, companyId)
    return { assigned: true, teamId: leastLoadedTeam.id }
  }

  await prisma.enterpriseIncident.update({
    where: { id: incidentId },
    data: {
      assignedTeamId: best.teamId,
      assignedToId: best.userId,
    },
  })

  await publishDomainEvent({
    type: 'enterprise.incident.updated',
    companyId,
    actorId: undefined,
    entityType: 'enterprise_incident',
    entityId: incidentId,
    action: 'auto_assigned',
    payload: {
      assignedToId: best.userId,
      assignedToName: best.userName,
      assignedTeamId: best.teamId,
      teamName: best.teamName,
      score: best.score,
      reason: 'auto_assigner',
    },
  })

  logger.info('enterprise.auto_assigned', {
    companyId,
    incidentId,
    incidentNumber: incident.incidentNumber,
    userId: best.userId,
    teamId: best.teamId,
    score: best.score,
  })

  return { assigned: true, to: best.userId, teamId: best.teamId }
}

async function assignToTeam(incident: { id: string; incidentNumber: string }, teamId: string, companyId: string) {
  await prisma.enterpriseIncident.update({
    where: { id: incident.id },
    data: { assignedTeamId: teamId },
  })

  await publishDomainEvent({
    type: 'enterprise.incident.updated',
    companyId,
    entityType: 'enterprise_incident',
    entityId: incident.id,
    action: 'auto_assigned_to_team',
    payload: { assignedTeamId: teamId, reason: 'no_available_members' },
  })

  logger.info('enterprise.auto_assigned_team_only', {
    companyId,
    incidentId: incident.id,
    incidentNumber: incident.incidentNumber,
    teamId,
  })
}

export async function autoAssignUnassignedIncidents(companyId?: string): Promise<{ assigned: number; total: number }> {
  const where: Record<string, unknown> = {
    assignedToId: null,
    status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] },
  }
  if (companyId) where.companyId = companyId

  const unassigned = await prisma.enterpriseIncident.findMany({
    where,
    select: { id: true, companyId: true },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    take: 50,
  })

  let assigned = 0
  for (const incident of unassigned) {
    const result = await autoAssignIncident(incident.id, incident.companyId)
    if (result.assigned) assigned++
  }

  return { assigned, total: unassigned.length }
}
