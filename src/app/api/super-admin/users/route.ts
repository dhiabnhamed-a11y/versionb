import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireSessionUser } from '@/modules/shared/session'
import { isAuthorizedSuperAdminIdentity } from '@/lib/security'
import { prisma } from '@/lib/db'

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function numberFromDecimal(value: Prisma.Decimal | null | undefined) {
  return value ? Number(value.toString()) : 0
}

export async function GET(req: NextRequest) {
  const actor = await requireSessionUser()
  if (!actor.id || !isAuthorizedSuperAdminIdentity(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query') ?? ''

    const where: Prisma.UserWhereInput = {}
    if (query.trim()) {
      where.OR = [
        { name: { contains: query.trim(), mode: 'insensitive' } },
        { email: { contains: query.trim(), mode: 'insensitive' } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        createdAt: true,
        companyId: true,
        company: { select: { name: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const userIds = users.map((user) => user.id)
    const companyIds = Array.from(new Set(users.map((user) => user.companyId).filter(Boolean))) as string[]
    const now = new Date()
    const onlineSince = new Date(now.getTime() - 5 * 60 * 1000)
    const todayStart = startOfUtcDay(now)

    const [
      loginStats,
      activeSessionStats,
      workspaceOpensToday,
      timeEntryStats,
      timeEntryStatsToday,
      campaignStats,
    ] = userIds.length
      ? await Promise.all([
          prisma.authSession.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds } },
            _count: { _all: true },
            _max: { createdAt: true, lastSeenAt: true },
          }),
          prisma.authSession.groupBy({
            by: ['userId'],
            where: {
              userId: { in: userIds },
              status: 'ACTIVE',
              expiresAt: { gt: now },
              lastSeenAt: { gte: onlineSince },
            },
            _count: { _all: true },
            _max: { lastSeenAt: true },
          }),
          prisma.activity.groupBy({
            by: ['userId'],
            where: {
              userId: { in: userIds },
              action: 'workspace.opened',
              createdAt: { gte: todayStart },
            },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
          prisma.timeEntry.groupBy({
            by: ['employeeId'],
            where: { employeeId: { in: userIds } },
            _count: { _all: true },
            _sum: { hours: true },
            _max: { createdAt: true },
          }),
          prisma.timeEntry.groupBy({
            by: ['employeeId'],
            where: { employeeId: { in: userIds }, createdAt: { gte: todayStart } },
            _count: { _all: true },
          }),
          companyIds.length
            ? prisma.project.groupBy({
                by: ['companyId'],
                where: { companyId: { in: companyIds } },
                _count: { _all: true },
                _max: { createdAt: true },
              })
            : Promise.resolve([]),
        ])
      : [[], [], [], [], [], []]

    const loginByUser = new Map(loginStats.map((stat) => [stat.userId, stat]))
    const activeByUser = new Map(activeSessionStats.map((stat) => [stat.userId, stat]))
    const opensByUser = new Map(workspaceOpensToday.map((stat) => [stat.userId ?? '', stat]))
    const timeByUser = new Map(timeEntryStats.map((stat) => [stat.employeeId, stat]))
    const timeTodayByUser = new Map(timeEntryStatsToday.map((stat) => [stat.employeeId, stat]))
    const campaignsByCompany = new Map(campaignStats.map((stat) => [stat.companyId, stat]))

    const usersWithTraction = users.map((user) => {
      const login = loginByUser.get(user.id)
      const active = activeByUser.get(user.id)
      const opens = opensByUser.get(user.id)
      const time = timeByUser.get(user.id)
      const timeToday = timeTodayByUser.get(user.id)
      const campaigns = user.companyId ? campaignsByCompany.get(user.companyId) : null

      return {
        ...user,
        traction: {
          loginCount: login?._count._all ?? 0,
          lastLoginAt: login?._max.createdAt?.toISOString() ?? null,
          lastSeenAt: active?._max.lastSeenAt?.toISOString() ?? login?._max.lastSeenAt?.toISOString() ?? null,
          isConnected: Boolean(active && active._count._all > 0),
          activeSessionCount: active?._count._all ?? 0,
          workspaceOpensToday: opens?._count._all ?? 0,
          lastWorkspaceOpenAt: opens?._max.createdAt?.toISOString() ?? null,
          campaignCount: campaigns?._count._all ?? 0,
          lastCampaignCreatedAt: campaigns?._max.createdAt?.toISOString() ?? null,
          timeEntryCount: time?._count._all ?? 0,
          timeEntriesToday: timeToday?._count._all ?? 0,
          trackedHours: numberFromDecimal(time?._sum.hours),
        },
      }
    })

    return NextResponse.json({ users: usersWithTraction })
  } catch (error) {
    console.error('Failed to load users:', error)
    return NextResponse.json({ error: 'Failed to load users.' }, { status: 500 })
  }
}
