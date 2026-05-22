import { NextResponse } from 'next/server'
import { withLegacyApiGuard } from '@/lib/api/legacy-guard'
import { prisma } from '@/lib/db'
import { createCompanyInvite, getInviteTtlHours, InviteFlowError } from '@/lib/invites'

export async function GET(req: Request) {
  return withLegacyApiGuard(req, async (user) => {
    if (user.role === 'EMPLOYEE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!user.companyId) return NextResponse.json([])

    const employees = await prisma.user.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        assignedTasks: {
          select: { id: true, stage: true, priority: true, deadline: true },
        },
        activities: {
          select: { id: true, action: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
    return NextResponse.json(employees)
  })
}

export async function POST(req: Request) {
  return withLegacyApiGuard(req, async (user) => {
    try {
      if (!user.companyId) {
        return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
      }
      if (user.role === 'EMPLOYEE') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const TRIAL_SEAT_LIMIT = 5
      const [companyBilling, activeUserCount] = await Promise.all([
        prisma.company.findUnique({
          where: { id: user.companyId },
          select: { seatCount: true, subscriptionStatus: true },
        }),
        prisma.user.count({
          where: { companyId: user.companyId, accountStatus: 'ACTIVE' },
        }),
      ])

      if (!companyBilling) {
        return NextResponse.json({
          error: 'No billing account found. Please subscribe to add team members.',
          upgradeUrl: '/billing/upgrade',
        }, { status: 402 })
      }

      const status = companyBilling.subscriptionStatus as string
      if (status === 'ACTIVE' && activeUserCount >= companyBilling.seatCount) {
        return NextResponse.json({
          error: 'You have reached your seat limit. Please upgrade your plan to add more team members.',
          upgradeUrl: '/billing/upgrade',
        }, { status: 402 })
      }
      if (status === 'TRIAL' && activeUserCount >= TRIAL_SEAT_LIMIT) {
        return NextResponse.json({
          error: `Free trial is limited to ${TRIAL_SEAT_LIMIT} users. Upgrade to add more team members.`,
          upgradeUrl: '/billing/upgrade',
        }, { status: 402 })
      }
      if (status === 'PAST_DUE') {
        return NextResponse.json({
          error: 'Your subscription is past due. Please update your billing to add team members.',
          upgradeUrl: '/billing/upgrade',
        }, { status: 402 })
      }
      if (status === 'CANCELED') {
        return NextResponse.json({
          error: 'Your subscription has been canceled. Please subscribe to add team members.',
          upgradeUrl: '/billing/upgrade',
        }, { status: 402 })
      }
      if (status === 'PAUSED') {
        return NextResponse.json({
          error: 'Your subscription is paused. Please resume your subscription to add team members.',
          upgradeUrl: '/billing/upgrade',
        }, { status: 402 })
      }

      const { email, role, ttlHours } = (await req.json()) as { email: string; role?: string; ttlHours?: number }
      const invite = await createCompanyInvite({
        companyId: user.companyId,
        companyAdminId: user.id,
        companyAdminRole: user.role ?? 'EMPLOYEE',
        email,
        role: role || 'EMPLOYEE',
        ttlHours: ttlHours ?? getInviteTtlHours(),
      })
      return NextResponse.json(invite, { status: 201 })
    } catch (err) {
      if (err instanceof InviteFlowError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      console.error(err)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
  })
}
