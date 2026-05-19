import { NextRequest, NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { getStripe, getStripeCustomer } from '@/lib/stripe'
import { PLANS } from '@/lib/plans'
import type { PlanKey } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = user.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'No company associated with your account.' }, { status: 400 })
  }

  let body: { planKey?: string; seats?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { planKey, seats } = body

  if (!planKey || !(planKey in PLANS)) {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
  }

  const plan = PLANS[planKey as PlanKey]
  const seatCount = Number(seats) || 1

  if (seatCount < plan.minSeats) {
    return NextResponse.json({ error: `Minimum ${plan.minSeats} seat(s) required for this plan.` }, { status: 400 })
  }

  if (plan.maxSeats !== null && seatCount > plan.maxSeats) {
    return NextResponse.json({ error: `Maximum ${plan.maxSeats} seat(s) allowed for this plan.` }, { status: 400 })
  }

  const stripePriceId = plan.stripePriceId
  if (!stripePriceId) {
    return NextResponse.json({ error: 'This plan is not yet configured. Contact support.' }, { status: 503 })
  }

  try {
    const stripe = getStripe()
    const customerId = await getStripeCustomer(companyId)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const isOneTime = 'oneTime' in plan && plan.oneTime === true

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: isOneTime ? 'payment' : 'subscription',
      line_items: [
        {
          price: stripePriceId,
          quantity: seatCount,
        },
      ],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/upgrade`,
      metadata: {
        companyId,
        planKey,
        seats: String(seatCount),
      },
      ...(isOneTime
        ? {}
        : {
            subscription_data: {
              metadata: { companyId, planKey, seats: String(seatCount) },
            },
          }),
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[billing/create-checkout-session]', error)
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 })
  }
}
