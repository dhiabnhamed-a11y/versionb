import { NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = user.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'No company associated with your account.' }, { status: 400 })
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
      planType: true,
      seatCount: true,
      billingInterval: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
    },
  })

  if (!company) {
    return NextResponse.json({ error: 'Company not found.' }, { status: 404 })
  }

  const now = new Date()
  const trialDaysRemaining =
    company.subscriptionStatus === 'TRIAL' && company.trialEndsAt
      ? Math.max(0, Math.ceil((company.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null

  return NextResponse.json({
    subscriptionStatus: company.subscriptionStatus,
    trialEndsAt: company.trialEndsAt?.toISOString() ?? null,
    trialDaysRemaining,
    planType: company.planType,
    seatCount: company.seatCount,
    billingInterval: company.billingInterval,
    currentPeriodEnd: company.currentPeriodEnd?.toISOString() ?? null,
    hasStripeCustomer: Boolean(company.stripeCustomerId),
  })
}
