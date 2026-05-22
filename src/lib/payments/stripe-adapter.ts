import type { PaymentProviderAdapter, CheckoutSessionParams, CheckoutSessionResult, PortalSessionParams, PortalSessionResult } from './types'
import { getStripe, getStripeCustomer } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { PLANS } from '@/lib/plans'
import type { PlanKey } from '@/lib/plans'

export class StripeAdapter implements PaymentProviderAdapter {
  readonly name = 'stripe' as const

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const plan = PLANS[params.planKey as PlanKey]
    if (!plan) throw new Error(`Invalid plan key: ${params.planKey}`)

    const stripePriceId = plan.stripePriceId
    if (!stripePriceId) {
      throw new Error('This plan is not yet configured with Stripe.')
    }

    const stripe = getStripe()
    const customerId = await getStripeCustomer(params.companyId)

    const isOneTime = 'oneTime' in plan && plan.oneTime === true

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: isOneTime ? 'payment' : 'subscription',
      line_items: [
        {
          price: stripePriceId,
          quantity: params.seats,
        },
      ],
      success_url: `${params.returnUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${params.returnUrl}/billing/upgrade`,
      metadata: {
        companyId: params.companyId,
        planKey: params.planKey,
        seats: String(params.seats),
      },
      ...(isOneTime
        ? {}
        : {
            subscription_data: {
              metadata: { companyId: params.companyId, planKey: params.planKey, seats: String(params.seats) },
            },
          }),
    })

    if (!session.url) throw new Error('Stripe checkout session returned no URL.')
    return { url: session.url }
  }

  async createPortalSession(params: PortalSessionParams): Promise<PortalSessionResult> {
    const company = await prisma.company.findUnique({
      where: { id: params.companyId },
      select: { stripeCustomerId: true },
    })

    if (!company?.stripeCustomerId) {
      throw new Error('No Stripe customer found for this company.')
    }

    const stripe = getStripe()
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: company.stripeCustomerId,
      return_url: params.returnUrl,
    })

    return { url: portalSession.url }
  }
}
