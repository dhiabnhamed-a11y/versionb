import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiData, handleApiRoute, type ApiParams } from '@/lib/api'
import { absoluteAppUrl, syncCompanyBillingFromSubscription } from '@/lib/billing-subscriptions'
import { prisma } from '@/lib/db'
import { createCheckoutSession, getDodoClient, toDodoErrorMessage } from '@/lib/dodo'
import { calculateWorkspacePrice, getDodoProductId, getWorkspaceById } from '@/lib/pricing'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const changeIntervalSchema = z.object({ interval: z.enum(['monthly', 'annual', 'lifetime']) })

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute<ApiParams, unknown>(
req,
undefined,
async ({ user }) => {
  const body = changeIntervalSchema.parse(await req.json().catch(() => ({})))
  const subscription = await prisma.workspaceSubscription.findFirst({ orderBy: { createdAt: 'desc' }, where: { userId: user.id } })
  if (!subscription) return apiData({ error: 'No subscription found.' }, { status: 404 }) as never
  const workspace = getWorkspaceById(subscription.workspaceId)
  if (!workspace) return apiData({ error: 'Invalid workspace.' }, { status: 400 }) as never
  const price = calculateWorkspacePrice({ interval: body.interval, quantity: subscription.seatCount, workspaceId: workspace.id })

  try {
    if (body.interval === 'lifetime') {
      const checkout = await createCheckoutSession({
        cancelUrl: absoluteAppUrl('/account/billing'),
        customerEmail: user.email ?? '',
        customerName: user.name ?? undefined,
        interval: 'lifetime',
        quantity: subscription.seatCount,
        successUrl: absoluteAppUrl(`/onboarding/success?workspace=${encodeURIComponent(workspace.id)}`),
        userId: user.id,
        workspaceId: workspace.id,
        workspaceSubscriptionId: subscription.id,
      })
      return apiData({ total: checkout.total, url: checkout.url })
    }

    if (subscription.dodoSubscriptionId) {
      await getDodoClient().subscriptions.changePlan(subscription.dodoSubscriptionId, {
        metadata: {
          interval: body.interval,
          quantity: String(price.displayQuantity),
          workspace_id: workspace.id,
        },
        product_id: getDodoProductId(workspace.id, body.interval),
        proration_billing_mode: 'prorated_immediately',
        quantity: price.billableQuantity,
      })
    }

    const updated = await prisma.workspaceSubscription.update({
      where: { id: subscription.id },
      data: { interval: body.interval, seatCount: price.displayQuantity },
    })
    await syncCompanyBillingFromSubscription({
      billingModel: workspace.billingModel,
      currentPeriodEnd: updated.currentPeriodEnd,
      dodoCustomerId: updated.dodoCustomerId,
      dodoSubscriptionId: updated.dodoSubscriptionId,
      interval: body.interval,
      seatCount: updated.seatCount,
      status: updated.status as 'active' | 'trialing' | 'past_due' | 'cancelled',
      userId: user.id,
      workspaceId: workspace.id,
    })

    return apiData({ interval: updated.interval, total: price.total })
  } catch (error) {
    return apiData({ error: toDodoErrorMessage(error) }, { status: 502 }) as never
  }
},
{ auth: 'required', route: '/api/billing/change-interval' }
)
}, { auth: 'required' });
