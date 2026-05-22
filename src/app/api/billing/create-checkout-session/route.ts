import { NextRequest, NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { PLANS } from '@/lib/plans'
import { AppError } from '@/modules/shared/errors'
import type { PlanKey } from '@/lib/plans'
import { getPaymentAdapter } from '@/lib/payments/provider'
import type { PaymentProviderName } from '@/lib/payments/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = user.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'No company associated with your account.' }, { status: 400 })
    }

    let body: { planKey?: string; seats?: number; provider?: PaymentProviderName }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const { planKey, seats, provider } = body

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

    const adapter = getPaymentAdapter(provider)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

    const result = await adapter.createCheckoutSession({
      planKey,
      seats: seatCount,
      companyId,
      companyName: '',
      customerEmail: user.email || '',
      customerName: user.name || '',
      returnUrl: appUrl,
    })

    return NextResponse.json({ url: result.url })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[billing/create-checkout-session]', error)
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 })
  }
}
