import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, type ApiParams } from '@/lib/api'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      if (!user.companyId) {
        return apiData({ error: 'No company associated with your account.' }, { status: 400 }) as never
      }

      const company = await prisma.company.findUnique({
        where: { id: user.companyId },
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
        return apiData({ error: 'Company not found.' }, { status: 404 }) as never
      }

      const now = new Date()
      const trialDaysRemaining =
        company.subscriptionStatus === 'TRIAL' && company.trialEndsAt
          ? Math.max(0, Math.ceil((company.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : null

      return apiData({
        subscriptionStatus: company.subscriptionStatus,
        trialEndsAt: company.trialEndsAt?.toISOString() ?? null,
        trialDaysRemaining,
        planType: company.planType,
        seatCount: company.seatCount,
        billingInterval: company.billingInterval,
        currentPeriodEnd: company.currentPeriodEnd?.toISOString() ?? null,
        hasBillingAccount: Boolean(company.stripeCustomerId),
      })
    },
    {
      auth: 'required',
      rateLimit: { max: 30, namespace: 'billing.status', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/billing/status',
    }
  )
}
