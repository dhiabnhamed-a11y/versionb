import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, type ApiParams } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getPaymentAdapter } from '@/lib/payments/provider'
import type { PaymentProviderName } from '@/lib/payments/types'

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
        select: { stripeCustomerId: true, stripeSubscriptionId: true, subscriptionId: true },
      })

      if (!company?.stripeCustomerId) {
        return apiData({ error: 'No billing account found. Please subscribe first.' }, { status: 404 }) as never
      }

      const provider: PaymentProviderName = company.subscriptionId ? 'dodo' : company.stripeSubscriptionId ? 'stripe' : 'dodo'
      const adapter = getPaymentAdapter(provider)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

      const result = await adapter.createPortalSession({
        companyId: user.companyId,
        returnUrl: `${appUrl}/workspace/${encodeURIComponent(user.companyId)}/settings/billing`,
      })

      return apiData({ url: result.url }, { code: 'PORTAL_SESSION_CREATED' })
    },
    {
      auth: 'required',
      rateLimit: { max: 5, namespace: 'billing.portal', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/billing/portal',
    }
  )
}
