import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiData, handleApiRoute, validateJson, type ApiParams } from '@/lib/api'
import { PLANS } from '@/lib/plans'
import type { PlanKey } from '@/lib/plans'
import { getPaymentAdapter } from '@/lib/payments/provider'
import type { PaymentProviderName } from '@/lib/payments/types'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createCheckoutSchema = z.object({
  planKey: z.string().refine((v) => v in PLANS, { message: 'Invalid plan' }),
  seats: z.coerce.number().int().min(1).optional().default(1),
  provider: z.string().optional(),
})

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute<ApiParams, unknown>(
req,
undefined,
async ({ user }) => {
  if (!user.companyId) {
    return apiData({ error: 'No company associated with your account.' }, { status: 400 }) as never
  }

  const body = await validateJson(req, createCheckoutSchema)
  const plan = PLANS[body.planKey as PlanKey]
  const seatCount = body.seats

  if (seatCount < plan.minSeats) {
    return apiData({ error: `Minimum ${plan.minSeats} seat(s) required for this plan.` }, { status: 400 })
  }
  if (plan.maxSeats !== null && seatCount > plan.maxSeats) {
    return apiData({ error: `Maximum ${plan.maxSeats} seat(s) allowed for this plan.` }, { status: 400 })
  }

  const adapter = getPaymentAdapter(body.provider as PaymentProviderName | undefined)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const result = await adapter.createCheckoutSession({
    planKey: body.planKey,
    seats: seatCount,
    companyId: user.companyId,
    companyName: '',
    customerEmail: user.email || '',
    customerName: user.name || '',
    returnUrl: appUrl,
  })

  return apiData({ url: result.url }, { code: 'CHECKOUT_SESSION_CREATED' })
},
{
  auth: 'required',
  rateLimit: { max: 5, namespace: 'billing.checkout', windowMs: 60_000 },
  responseMode: 'canonical',
  route: '/api/billing/create-checkout-session',
}
)
}, { auth: 'required' });
