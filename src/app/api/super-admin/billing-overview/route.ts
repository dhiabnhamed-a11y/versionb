import { NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'
import { isAuthorizedSuperAdminIdentity } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await requireSessionUser()
  if (!user || !isAuthorizedSuperAdminIdentity(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [total, trialCount, trialExpiringWeek, activeCount, pastDueCount, canceledCount, activeSeatSum] =
    await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { subscriptionStatus: 'TRIAL' } }),
      prisma.company.count({
        where: { subscriptionStatus: 'TRIAL', trialEndsAt: { gte: now, lte: oneWeekFromNow } },
      }),
      prisma.company.count({ where: { subscriptionStatus: 'ACTIVE' } }),
      prisma.company.count({ where: { subscriptionStatus: 'PAST_DUE' } }),
      prisma.company.count({ where: { subscriptionStatus: 'CANCELED' } }),
      prisma.company.aggregate({
        where: { subscriptionStatus: 'ACTIVE' },
        _sum: { seatCount: true },
      }),
    ])

  const totalActiveSeats = activeSeatSum._sum.seatCount ?? 0
  const mrrEstimate = totalActiveSeats * 3

  return NextResponse.json({
    total,
    trial: trialCount,
    trialExpiringThisWeek: trialExpiringWeek,
    active: activeCount,
    pastDue: pastDueCount,
    canceled: canceledCount,
    totalActiveSeats,
    mrrEstimate,
  })
}
