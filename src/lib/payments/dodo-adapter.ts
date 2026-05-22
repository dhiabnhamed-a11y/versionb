import DodoPayments from 'dodopayments'
import type { PaymentProviderAdapter, CheckoutSessionParams, CheckoutSessionResult, PortalSessionParams, PortalSessionResult } from './types'
import { prisma } from '@/lib/db'
import { PLANS } from '@/lib/plans'
import type { PlanKey } from '@/lib/plans'

let _dodo: DodoPayments | null = null

function getDodoClient(): DodoPayments {
  if (!_dodo) {
    const key = process.env.DODO_PAYMENTS_API_KEY
    if (!key) throw new Error('DODO_PAYMENTS_API_KEY is not set')
    _dodo = new DodoPayments({
      bearerToken: key,
      environment: process.env.DODO_ENV === 'live' ? 'live_mode' : 'test_mode',
    })
  }
  return _dodo
}

export class DodoAdapter implements PaymentProviderAdapter {
  readonly name = 'dodo' as const

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const plan = PLANS[params.planKey as PlanKey]
    if (!plan) throw new Error(`Invalid plan key: ${params.planKey}`)

    const productId = plan.dodoProductId
    if (!productId) {
      throw new Error(`No Dodo product ID configured for plan: ${params.planKey}`)
    }

    const dodo = getDodoClient()

    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: params.seats }],
      customer: {
        email: params.customerEmail,
        name: params.customerName,
      },
      metadata: {
        companyId: params.companyId,
        planKey: params.planKey,
        seats: String(params.seats),
      },
      return_url: `${params.returnUrl}/billing/success`,
    })

    if (!session.checkout_url) {
      throw new Error('Dodo checkout session returned no URL.')
    }

    return { url: session.checkout_url }
  }

  async createPortalSession(params: PortalSessionParams): Promise<PortalSessionResult> {
    const company = await prisma.company.findUnique({
      where: { id: params.companyId },
      select: { stripeCustomerId: true },
    })

    if (!company?.stripeCustomerId) {
      throw new Error('No Dodo customer found for this company.')
    }

    const dodo = getDodoClient()
    const portal = await dodo.customers.customerPortal.create(company.stripeCustomerId, {
      return_url: params.returnUrl,
    })

    return { url: portal.link }
  }
}
