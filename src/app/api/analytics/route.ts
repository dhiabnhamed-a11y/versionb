import { requireSessionUser } from '@/modules/shared/session'
import { requireMinimumRole } from '@/modules/security/access-control'
import { NextResponse } from 'next/server'
import { cached } from '@/lib/cache'
import { API_RATE_LIMITS } from '@/lib/api-defaults'
import { INFRA } from '@/lib/infra/config'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'
import { normalizeError } from '@/modules/shared/errors'
import { getRequestId } from '@/lib/api/request-id'

export const runtime = 'nodejs'

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

export async function GET(req: Request) {
  const requestId = getRequestId(req)

  try {
  const rate = await enforceDistributedRateLimit(req, API_RATE_LIMITS.read)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE_HEADERS })
  }

  const user = await requireSessionUser()
  requireMinimumRole(user, 'MANAGER')
  if (!user.companyId) {
    return NextResponse.json(
      {
        totalTasks: 0,
        doneTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        totalEmployees: 0,
        totalUsers: 0,
        activeUsers: 0,
        totalProjects: 0,
        completionRate: 0,
        performance: [],
        teamPerformance: [],
        activitySeries: [],
        taskStageBreakdown: [],
        rolesDistribution: [],
        recentActivity: [],
        growth: {
          users: 0,
          activeUsers: 0,
          projects: 0,
          tasks: 0,
          completedTasks: 0,
        },
      },
      { headers: NO_STORE_HEADERS }
    )
  }

    const companyId = user.companyId
    const payload = await cached(`analytics:${companyId}`, INFRA.analyticsCacheTtlSec, async () => {
    const now = new Date()
    const thisWeekStart = addDays(startOfDay(now), -6)
    const lastWeekStart = addDays(thisWeekStart, -7)
    const lastWeekEnd = thisWeekStart
    const rangeDays = Array.from({ length: 7 }, (_, index) => addDays(thisWeekStart, index))

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        companyType: true,
      },
    })

    const [
      totalTasks,
      doneTasks,
      inProgressTasks,
      reviewTasks,
      todoTasks,
      overdueTasks,
      totalEmployees,
      totalUsers,
      activeUsers,
      totalProjects,
      roomCount,
      submissionCount,
      usersThisWeek,
      usersLastWeek,
      activeUsersLastWeek,
      projectsThisWeek,
      projectsLastWeek,
      tasksThisWeek,
      tasksLastWeek,
      completedThisWeek,
      completedLastWeek,
    ] =
      await Promise.all([
        prisma.task.count({ where: { project: { companyId } } }),
        prisma.task.count({ where: { stage: 'DONE', project: { companyId } } }),
        prisma.task.count({ where: { stage: 'IN_PROGRESS', project: { companyId } } }),
        prisma.task.count({ where: { stage: 'REVIEW', project: { companyId } } }),
        prisma.task.count({ where: { stage: 'TODO', project: { companyId } } }),
        prisma.task.count({
          where: {
            stage: { not: 'DONE' },
            deadline: { lt: new Date() },
            project: { companyId },
          },
        }),
        prisma.user.count({ where: { companyId, role: 'EMPLOYEE' } }),
        prisma.user.count({ where: { companyId } }),
        prisma.user.count({
          where: {
            companyId,
            activities: { some: { createdAt: { gte: thisWeekStart } } },
          },
        }),
        prisma.project.count({ where: { companyId } }),
        prisma.room.count({ where: { companyId } }),
        prisma.taskSubmission.count({ where: { task: { project: { companyId } } } }),
        prisma.user.count({ where: { companyId, createdAt: { gte: thisWeekStart } } }),
        prisma.user.count({
          where: {
            companyId,
            createdAt: { gte: lastWeekStart, lt: lastWeekEnd },
          },
        }),
        prisma.user.count({
          where: {
            companyId,
            activities: {
              some: {
                createdAt: { gte: lastWeekStart, lt: lastWeekEnd },
              },
            },
          },
        }),
        prisma.project.count({ where: { companyId, createdAt: { gte: thisWeekStart } } }),
        prisma.project.count({
          where: { companyId, createdAt: { gte: lastWeekStart, lt: lastWeekEnd } },
        }),
        prisma.task.count({ where: { project: { companyId }, createdAt: { gte: thisWeekStart } } }),
        prisma.task.count({
          where: { project: { companyId }, createdAt: { gte: lastWeekStart, lt: lastWeekEnd } },
        }),
        prisma.task.count({ where: { stage: 'DONE', project: { companyId }, updatedAt: { gte: thisWeekStart } } }),
        prisma.task.count({
          where: {
            stage: 'DONE',
            project: { companyId },
            updatedAt: { gte: lastWeekStart, lt: lastWeekEnd },
          },
        }),
      ])

    // Employee performance: tasks done per person
    const employeePerf = await prisma.user.findMany({
      where: { companyId, role: 'EMPLOYEE' },
      select: {
        id: true,
        name: true,
        assignedTasks: { select: { stage: true } },
      },
      take: 10,
    })

    const roles = await prisma.user.groupBy({
      by: ['role'],
      where: { companyId },
      _count: { role: true },
    })

    const [tasksCreatedThisWeek, tasksCompletedThisWeek, recentActivities] = await Promise.all([
      prisma.task.findMany({
        where: {
          project: { companyId },
          createdAt: { gte: thisWeekStart },
        },
        select: { createdAt: true },
      }),
      prisma.task.findMany({
        where: {
          stage: 'DONE',
          project: { companyId },
          updatedAt: { gte: thisWeekStart },
        },
        select: { updatedAt: true },
      }),
      prisma.activity.findMany({
        where: {
          task: { project: { companyId } },
        },
        include: {
          user: { select: { id: true, name: true, role: true, avatar: true } },
          task: {
            select: {
              id: true,
              title: true,
              stage: true,
              project: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    const createdByDay = new Map<string, number>()
    const completedByDay = new Map<string, number>()
    for (const task of tasksCreatedThisWeek) {
      const key = startOfDay(task.createdAt).toISOString()
      createdByDay.set(key, (createdByDay.get(key) ?? 0) + 1)
    }
    for (const task of tasksCompletedThisWeek) {
      const key = startOfDay(task.updatedAt).toISOString()
      completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1)
    }

    const performance = employeePerf.map((e) => ({
      name: e.name,
      done: e.assignedTasks.filter((t) => t.stage === 'DONE').length,
      total: e.assignedTasks.length,
      score: e.assignedTasks.length
        ? Math.round((e.assignedTasks.filter((t) => t.stage === 'DONE').length / e.assignedTasks.length) * 100)
        : 0,
    }))
    const completionRate = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0

    return {
        companyType: company?.companyType ?? 'OTHER',
        totalTasks,
        doneTasks,
        inProgressTasks,
        reviewTasks,
        todoTasks,
        overdueTasks,
        totalEmployees,
        totalUsers,
        activeUsers,
        totalProjects,
        roomCount,
        submissionCount,
        completionRate,
        performance,
        teamPerformance: performance,
        taskStageBreakdown: [
          { name: 'To Do', value: todoTasks, stage: 'TODO', color: '#64748b' },
          { name: 'In Progress', value: inProgressTasks, stage: 'IN_PROGRESS', color: '#0f766e' },
          { name: 'Review', value: reviewTasks, stage: 'REVIEW', color: '#d97706' },
          { name: 'Done', value: doneTasks, stage: 'DONE', color: '#059669' },
        ],
        rolesDistribution: roles.map((role) => ({
          name: role.role.replace('_', ' '),
          value: role._count.role,
        })),
        activitySeries: rangeDays.map((day) => {
          const key = startOfDay(day).toISOString()
          return {
            date: key,
            label: day.toLocaleDateString('en-US', { weekday: 'short' }),
            created: createdByDay.get(key) ?? 0,
            completed: completedByDay.get(key) ?? 0,
          }
        }),
        recentActivity: recentActivities.map((activity) => ({
          id: activity.id,
          action: activity.action,
          createdAt: activity.createdAt,
          user: activity.user,
          task: activity.task,
        })),
        growth: {
          users: percentChange(usersThisWeek, usersLastWeek),
          activeUsers: percentChange(activeUsers, activeUsersLastWeek),
          projects: percentChange(projectsThisWeek, projectsLastWeek),
          tasks: percentChange(tasksThisWeek, tasksLastWeek),
          completedTasks: percentChange(completedThisWeek, completedLastWeek),
        },
        comparison: {
          thisWeek: {
            users: usersThisWeek,
            activeUsers,
            projects: projectsThisWeek,
            tasks: tasksThisWeek,
            completedTasks: completedThisWeek,
          },
          lastWeek: {
            users: usersLastWeek,
            activeUsers: activeUsersLastWeek,
            projects: projectsLastWeek,
            tasks: tasksLastWeek,
            completedTasks: completedLastWeek,
          },
        },
      }
    })

    return NextResponse.json(payload, { headers: NO_STORE_HEADERS })
  } catch (err) {
    const normalized = normalizeError(err)
    console.error(err)
    return NextResponse.json(
      {
        error: normalized.expose ? normalized.message : 'Server error',
        code: normalized.code,
        requestId,
      },
      { status: normalized.status, headers: NO_STORE_HEADERS }
    )
  }
}
