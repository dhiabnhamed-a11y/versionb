import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type SessionUser = {
  companyId?: string | null
}

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

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) {
    return NextResponse.json({
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
    })
  }

  try {
    const now = new Date()
    const thisWeekStart = addDays(startOfDay(now), -6)
    const lastWeekStart = addDays(thisWeekStart, -7)
    const lastWeekEnd = thisWeekStart
    const rangeDays = Array.from({ length: 7 }, (_, index) => addDays(thisWeekStart, index))

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
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
        prisma.task.count({ where: { project: { companyId: user.companyId } } }),
        prisma.task.count({ where: { stage: 'DONE', project: { companyId: user.companyId } } }),
        prisma.task.count({ where: { stage: 'IN_PROGRESS', project: { companyId: user.companyId } } }),
        prisma.task.count({ where: { stage: 'REVIEW', project: { companyId: user.companyId } } }),
        prisma.task.count({ where: { stage: 'TODO', project: { companyId: user.companyId } } }),
        prisma.task.count({
          where: {
            stage: { not: 'DONE' },
            deadline: { lt: new Date() },
            project: { companyId: user.companyId },
          },
        }),
        prisma.user.count({ where: { companyId: user.companyId, role: 'EMPLOYEE' } }),
        prisma.user.count({ where: { companyId: user.companyId } }),
        prisma.user.count({
          where: {
            companyId: user.companyId,
            activities: { some: { createdAt: { gte: thisWeekStart } } },
          },
        }),
        prisma.project.count({ where: { companyId: user.companyId } }),
        prisma.room.count({ where: { companyId: user.companyId } }),
        prisma.taskSubmission.count({ where: { task: { project: { companyId: user.companyId } } } }),
        prisma.user.count({ where: { companyId: user.companyId, createdAt: { gte: thisWeekStart } } }),
        prisma.user.count({
          where: {
            companyId: user.companyId,
            createdAt: { gte: lastWeekStart, lt: lastWeekEnd },
          },
        }),
        prisma.user.count({
          where: {
            companyId: user.companyId,
            activities: {
              some: {
                createdAt: { gte: lastWeekStart, lt: lastWeekEnd },
              },
            },
          },
        }),
        prisma.project.count({ where: { companyId: user.companyId, createdAt: { gte: thisWeekStart } } }),
        prisma.project.count({
          where: { companyId: user.companyId, createdAt: { gte: lastWeekStart, lt: lastWeekEnd } },
        }),
        prisma.task.count({ where: { project: { companyId: user.companyId }, createdAt: { gte: thisWeekStart } } }),
        prisma.task.count({
          where: { project: { companyId: user.companyId }, createdAt: { gte: lastWeekStart, lt: lastWeekEnd } },
        }),
        prisma.task.count({ where: { stage: 'DONE', project: { companyId: user.companyId }, updatedAt: { gte: thisWeekStart } } }),
        prisma.task.count({
          where: {
            stage: 'DONE',
            project: { companyId: user.companyId },
            updatedAt: { gte: lastWeekStart, lt: lastWeekEnd },
          },
        }),
      ])

    // Employee performance: tasks done per person
    const employeePerf = await prisma.user.findMany({
      where: { companyId: user.companyId, role: 'EMPLOYEE' },
      select: {
        id: true,
        name: true,
        assignedTasks: { select: { stage: true } },
      },
      take: 10,
    })

    const roles = await prisma.user.groupBy({
      by: ['role'],
      where: { companyId: user.companyId },
      _count: { role: true },
    })

    const [tasksCreatedThisWeek, tasksCompletedThisWeek, recentActivities] = await Promise.all([
      prisma.task.findMany({
        where: {
          project: { companyId: user.companyId },
          createdAt: { gte: thisWeekStart },
        },
        select: { createdAt: true },
      }),
      prisma.task.findMany({
        where: {
          stage: 'DONE',
          project: { companyId: user.companyId },
          updatedAt: { gte: thisWeekStart },
        },
        select: { updatedAt: true },
      }),
      prisma.activity.findMany({
        where: {
          task: { project: { companyId: user.companyId } },
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

    return NextResponse.json({
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
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
