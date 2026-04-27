import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type SessionUser = {
  companyId?: string | null
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
      performance: [],
    })
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        companyType: true,
      },
    })

    const [totalTasks, doneTasks, inProgressTasks, overdueTasks, totalEmployees, roomCount, submissionCount] =
      await Promise.all([
        prisma.task.count({ where: { project: { companyId: user.companyId } } }),
        prisma.task.count({ where: { stage: 'DONE', project: { companyId: user.companyId } } }),
        prisma.task.count({ where: { stage: 'IN_PROGRESS', project: { companyId: user.companyId } } }),
        prisma.task.count({
          where: {
            stage: { not: 'DONE' },
            deadline: { lt: new Date() },
            project: { companyId: user.companyId },
          },
        }),
        prisma.user.count({ where: { companyId: user.companyId, role: 'EMPLOYEE' } }),
        prisma.room.count({ where: { companyId: user.companyId } }),
        prisma.taskSubmission.count({ where: { task: { project: { companyId: user.companyId } } } }),
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

    const performance = employeePerf.map((e) => ({
      name: e.name,
      done: e.assignedTasks.filter((t) => t.stage === 'DONE').length,
      total: e.assignedTasks.length,
      score: e.assignedTasks.length
        ? Math.round((e.assignedTasks.filter((t) => t.stage === 'DONE').length / e.assignedTasks.length) * 100)
        : 0,
    }))

    return NextResponse.json({
      companyType: company?.companyType ?? 'OTHER',
      totalTasks,
      doneTasks,
      inProgressTasks,
      overdueTasks,
      totalEmployees,
      roomCount,
      submissionCount,
      performance,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
