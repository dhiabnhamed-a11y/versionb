import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, type ApiParams } from '@/lib/api'
import { getCurrentWorkspaceSubscription, mapDodoSubscriptionStatus } from '@/lib/billing-subscriptions'
import { retrieveDodoSubscription } from '@/lib/dodo'
import { calculateWorkspacePrice, getWorkspaceById } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      const subscription = await getCurrentWorkspaceSubscription(user.id)
      if (!subscription) return apiData({ subscription: null })

      const workspace = getWorkspaceById(subscription.workspaceId)
      const dodo =
        subscription.dodoSubscriptionId && subscription.interval !== 'lifetime'
          ? await retrieveDodoSubscription(subscription.dodoSubscriptionId)
          : null
      const status = dodo ? mapDodoSubscriptionStatus(dodo.status) : subscription.status
      const price = workspace
        ? calculateWorkspacePrice({
            interval: subscription.interval as 'monthly' | 'annual' | 'lifetime',
            quantity: subscription.seatCount,
            workspaceId: subscription.workspaceId,
          })
        : null

      return apiData({
        subscription: {
          amount: dodo ? dodo.recurring_pre_tax_amount / 100 : price?.total ?? null,
          currentPeriodEnd: dodo?.next_billing_date ?? subscription.currentPeriodEnd?.toISOString() ?? null,
          dodoCustomerId: subscription.dodoCustomerId,
          dodoSubscriptionId: subscription.dodoSubscriptionId,
          interval: subscription.interval,
          seatCount: subscription.seatCount,
          status,
          workspace,
        },
      })
    },
    { auth: 'required', route: '/api/billing/subscription' }
  )
}
