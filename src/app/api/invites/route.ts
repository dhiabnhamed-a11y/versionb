import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { createCompanyInvite, getInviteTtlHours, InviteFlowError, listCompanyInvites } from '@/lib/invites'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { prisma } from '@/lib/db'

export async function GET() {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!user.companyId) {
    return NextResponse.json([])
  }

  if (user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const invites = await listCompanyInvites(user.companyId)
    return NextResponse.json(invites)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load invites.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!user.companyId) {
    return NextResponse.json({ error: 'No company found for this account.' }, { status: 400 })
  }

  if (!user.id || user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as {
      email?: string
      role?: string
      ttlHours?: number
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

    if (companyBilling) {
      const status = companyBilling.subscriptionStatus as string
      if (status === 'ACTIVE' && activeUserCount >= companyBilling.seatCount) {
        return NextResponse.json(
          {
            error: 'You have reached your seat limit. Please upgrade your plan to add more team members.',
            upgradeUrl: '/billing/upgrade',
          },
          { status: 402 }
        )
      }
      if (status === 'TRIAL' && activeUserCount >= TRIAL_SEAT_LIMIT) {
        return NextResponse.json(
          {
            error: `Free trial is limited to ${TRIAL_SEAT_LIMIT} users. Upgrade to add more team members.`,
            upgradeUrl: '/billing/upgrade',
          },
          { status: 402 }
        )
      }
    }

    const invite = await createCompanyInvite({
      companyId: user.companyId,
      companyAdminId: user.id,
      companyAdminRole: user.role ?? 'EMPLOYEE',
      email: body.email ?? '',
      role: body.role ?? 'EMPLOYEE',
      ttlHours: body.ttlHours ?? getInviteTtlHours(),
    })

    emitCompanyRealtime(user.companyId, 'employee_invited', { invite })

    return NextResponse.json(invite, { status: 201 })
  } catch (error) {
    if (error instanceof InviteFlowError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)
    return NextResponse.json({ error: 'Failed to create invite.' }, { status: 500 })
  }
}
