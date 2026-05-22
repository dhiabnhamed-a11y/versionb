import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import BillingDashboardClient from './billing-client'
import { prisma } from '@/lib/db'

export default async function BillingPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login')
  }

  const companyId = session.user.companyId
  if (!companyId) {
    redirect('/login')
  }

  const [company, recentEvents] = await Promise.all([
    prisma.company.findUnique({
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
    }),
    prisma.subscriptionEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, event: true, payload: true, createdAt: true },
    }),
  ])

  if (!company) {
    redirect('/login')
  }

  const now = new Date()
  const trialDaysRemaining =
    company.subscriptionStatus === 'TRIAL' && company.trialEndsAt
      ? Math.max(0, Math.ceil((company.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null

  return (
    <BillingDashboardClient
      billing={{
        subscriptionStatus: company.subscriptionStatus as string,
        trialEndsAt: company.trialEndsAt?.toISOString() ?? null,
        trialDaysRemaining,
        planType: company.planType as string,
        seatCount: company.seatCount,
        billingInterval: (company.billingInterval ?? null) as string | null,
        currentPeriodEnd: company.currentPeriodEnd?.toISOString() ?? null,
        hasBillingAccount: Boolean(company.stripeCustomerId),
      }}
      events={recentEvents.map((e: { id: string; event: string; payload: unknown; createdAt: Date }) => ({
        id: e.id,
        event: e.event,
        payload: e.payload as Record<string, unknown> | null,
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  )
}
