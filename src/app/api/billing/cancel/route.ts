import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, type ApiParams } from '@/lib/api'
import { getCurrentWorkspaceSubscription, syncCompanyBillingFromSubscription } from '@/lib/billing-subscriptions'
import { getDodoClient, toDodoErrorMessage } from '@/lib/dodo'
import { getWorkspaceById } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      const subscription = await getCurrentWorkspaceSubscription(user.id)
      if (!subscription) return apiData({ error: 'No subscription found.' }, { status: 404 }) as never
      if (!subscription.dodoSubscriptionId) return apiData({ error: 'No recurring Dodo subscription found.' }, { status: 400 }) as never

      try {
        const dodo = await getDodoClient().subscriptions.update(subscription.dodoSubscriptionId, {
          cancel_at_next_billing_date: true,
          cancel_reason: 'cancelled_by_customer',
        })
        const currentPeriodEnd = new Date(dodo.next_billing_date)
        const updated = await prismaWorkspaceCancel(subscription.id, currentPeriodEnd)
        const workspace = getWorkspaceById(updated.workspaceId)
        if (workspace) {
          await syncCompanyBillingFromSubscription({
            billingModel: workspace.billingModel,
            currentPeriodEnd,
            dodoCustomerId: updated.dodoCustomerId,
            dodoSubscriptionId: updated.dodoSubscriptionId,
            interval: updated.interval as 'monthly' | 'annual' | 'lifetime',
            seatCount: updated.seatCount,
            status: 'cancelled',
            userId: user.id,
            workspaceId: updated.workspaceId,
          })
        }
        return apiData({ accessUntil: updated.currentPeriodEnd?.toISOString() ?? null, ok: true })
      } catch (error) {
        return apiData({ error: toDodoErrorMessage(error) }, { status: 502 }) as never
      }
    },
    { auth: 'required', rateLimit: { max: 4, namespace: 'billing.cancel', windowMs: 60_000 }, route: '/api/billing/cancel' }
  )
}

async function prismaWorkspaceCancel(id: string, currentPeriodEnd: Date) {
  const { prisma } = await import('@/lib/db')
  return prisma.workspaceSubscription.update({
    where: { id },
    data: {
      cancelledAt: new Date(),
      currentPeriodEnd,
      status: 'cancelled',
    },
  })
}
