import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiData, handleApiRoute, type ApiParams } from '@/lib/api'
import { prisma } from '@/lib/db'
import { syncCompanyBillingFromSubscription } from '@/lib/billing-subscriptions'
import { getDodoClient, toDodoErrorMessage } from '@/lib/dodo'
import { calculateWorkspacePrice, getDodoProductId, getWorkspaceById } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const updateSeatsSchema = z.object({ quantity: z.coerce.number().int().min(1).max(500) })

export async function POST(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      const body = updateSeatsSchema.parse(await req.json().catch(() => ({})))
      const subscription = await prisma.workspaceSubscription.findFirst({ orderBy: { createdAt: 'desc' }, where: { userId: user.id } })
      if (!subscription) return apiData({ error: 'No subscription found.' }, { status: 404 }) as never
      const workspace = getWorkspaceById(subscription.workspaceId)
      if (!workspace) return apiData({ error: 'Invalid workspace.' }, { status: 400 }) as never
      if (workspace.billingModel !== 'per_seat') return apiData({ error: 'Seat changes are only available for per-seat workspaces.' }, { status: 400 }) as never

      const interval = subscription.interval as 'monthly' | 'annual' | 'lifetime'
      const price = calculateWorkspacePrice({ interval, quantity: body.quantity, workspaceId: workspace.id })

      try {
        if (subscription.dodoSubscriptionId && interval !== 'lifetime') {
          await getDodoClient().subscriptions.changePlan(subscription.dodoSubscriptionId, {
            metadata: {
              interval,
              quantity: String(price.displayQuantity),
              workspace_id: workspace.id,
            },
            product_id: getDodoProductId(workspace.id, interval),
            proration_billing_mode: 'prorated_immediately',
            quantity: price.billableQuantity,
          })
        }

        const updated = await prisma.workspaceSubscription.update({
          where: { id: subscription.id },
          data: { seatCount: price.displayQuantity },
        })
        await syncCompanyBillingFromSubscription({
          billingModel: workspace.billingModel,
          currentPeriodEnd: updated.currentPeriodEnd,
          dodoCustomerId: updated.dodoCustomerId,
          dodoSubscriptionId: updated.dodoSubscriptionId,
          interval,
          seatCount: updated.seatCount,
          status: updated.status as 'active' | 'trialing' | 'past_due' | 'cancelled',
          userId: user.id,
          workspaceId: workspace.id,
        })

        return apiData({ quantity: updated.seatCount, total: price.total })
      } catch (error) {
        return apiData({ error: toDodoErrorMessage(error) }, { status: 502 }) as never
      }
    },
    { auth: 'required', route: '/api/billing/update-seats' }
  )
}
