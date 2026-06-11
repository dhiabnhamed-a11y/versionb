import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiData, handleApiRoute, type ApiParams } from '@/lib/api'
import { absoluteAppUrl, getOrCreatePendingWorkspaceSubscription } from '@/lib/billing-subscriptions'
import { createCheckoutSession, toDodoErrorMessage } from '@/lib/dodo'
import { calculateWorkspacePrice, getWorkspaceById } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const checkoutSchema = z.object({
  cancelUrl: z.string().optional().default('/signup?step=workspace'),
  interval: z.enum(['monthly', 'annual', 'lifetime']),
  quantity: z.coerce.number().int().min(1).max(500).default(1),
  successUrl: z.string().optional(),
  workspaceId: z.string(),
})

export async function POST(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      const body = checkoutSchema.parse(await req.json().catch(() => ({})))
      const workspace = getWorkspaceById(body.workspaceId)
      if (!workspace) return apiData({ error: 'Invalid workspace.' }, { status: 400 }) as never

      const price = calculateWorkspacePrice(body)
      const pending = await getOrCreatePendingWorkspaceSubscription({
        interval: body.interval,
        quantity: body.quantity,
        userId: user.id,
        workspaceId: body.workspaceId,
      })

      try {
        const checkout = await createCheckoutSession({
          cancelUrl: absoluteAppUrl(body.cancelUrl),
          customerEmail: user.email ?? '',
          customerName: user.name ?? undefined,
          interval: body.interval,
          quantity: price.displayQuantity,
          successUrl: absoluteAppUrl(body.successUrl ?? `/onboarding/success?workspace=${encodeURIComponent(body.workspaceId)}`),
          userId: user.id,
          workspaceId: body.workspaceId,
          workspaceSubscriptionId: pending.id,
        })

        return apiData({ url: checkout.url, total: checkout.total })
      } catch (error) {
        return apiData({ error: toDodoErrorMessage(error) }, { status: 502 }) as never
      }
    },
    {
      auth: 'required',
      rateLimit: { max: 6, namespace: 'billing.checkout.v2', windowMs: 60_000 },
      route: '/api/billing/checkout',
    }
  )
}
