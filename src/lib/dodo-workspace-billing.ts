import DodoPayments from 'dodopayments'
import { prisma } from '@/lib/db'
import {
  calculateWorkspacePlanTotal,
  clampSeatCount,
  getDefaultIsolation,
  getIsolationType,
  getWorkspacePlan,
  getWorkspacePricing,
  isFreePlan,
  type BillingCycle,
} from '@/lib/workspace-pricing'

let dodoClient: DodoPayments | null = null

export function getDodoWorkspaceClient() {
  if (!dodoClient) {
    const key = process.env.DODO_PAYMENTS_API_KEY
    if (!key) throw new Error('DODO_PAYMENTS_API_KEY is not set')
    dodoClient = new DodoPayments({
      bearerToken: key,
      environment: process.env.DODO_ENV === 'live' ? 'live_mode' : 'test_mode',
    })
  }
  return dodoClient
}

export type WorkspaceCheckoutInput = {
  companyId: string
  companyType: string
  customerEmail: string
  customerName: string
  planId: string
  seatCount?: number
  isolationEnabled?: boolean
  billingCycle?: BillingCycle
  returnUrl?: string
}

export async function createDodoWorkspaceCheckout(input: WorkspaceCheckoutInput) {
  const { key: workspaceType, pricing } = getWorkspacePricing(input.companyType)
  const plan = getWorkspacePlan(input.companyType, input.planId)
  if (!plan) throw new Error('Invalid plan for selected workspace type.')
  if (isFreePlan(plan)) return null

  const seatCount = clampSeatCount(pricing, input.seatCount)
  const isolationEnabled = plan.isolationLocked ? false : input.isolationEnabled ?? getDefaultIsolation(plan)
  const billingCycle = input.billingCycle ?? 'monthly'
  const total = calculateWorkspacePlanTotal({ pricing, plan, billingCycle, seatCount, isolationEnabled })
  const appUrl = (input.returnUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  const productCart = [
    { product_id: plan.id, quantity: total.quantity },
    ...(isolationEnabled && !plan.isolationIncluded
      ? [{ product_id: `${plan.id}_isolation`, quantity: total.quantity }]
      : []),
  ]

  const dodo = getDodoWorkspaceClient()
  const session = await dodo.checkoutSessions.create({
    product_cart: productCart,
    customer: {
      email: input.customerEmail,
      name: input.customerName,
    },
    metadata: {
      workspace_type: workspaceType,
      workspace_id: input.companyId,
      companyId: input.companyId,
      isolation_enabled: String(isolationEnabled),
      plan_id: plan.id,
      seat_count: String(seatCount),
      billing_type: pricing.billing,
      billing_cycle: billingCycle,
      annual_discount_percent: String(total.discountPercent),
    },
    subscription_data: { trial_period_days: 14 },
    return_url: `${appUrl}/workspace/${encodeURIComponent(input.companyId)}/dashboard`,
    cancel_url: `${appUrl}/signup?step=pricing`,
  })

  if (!session.checkout_url) {
    throw new Error('Dodo checkout session returned no URL.')
  }

  return { url: session.checkout_url, sessionId: session.session_id }
}

export async function applyFreeWorkspacePlan(input: {
  companyId: string
  companyType: string
  planId: string
  seatCount?: number
}) {
  const { pricing } = getWorkspacePricing(input.companyType)
  const plan = getWorkspacePlan(input.companyType, input.planId)
  if (!plan || !isFreePlan(plan)) throw new Error('Invalid free plan for selected workspace type.')
  const seats = plan.seats ?? clampSeatCount(pricing, input.seatCount)

  await prisma.company.update({
    where: { id: input.companyId },
    data: {
      planId: plan.id,
      billingType: pricing.billing,
      seatCount: seats,
      isolationEnabled: false,
      isolationType: 'shared',
      subscriptionStatus: 'TRIAL',
      subscriptionId: null,
      stripeSubscriptionId: null,
      billingInterval: null,
      metadata: {
        workspaceBilling: {
          planId: plan.id,
          billingType: pricing.billing,
          isolationEnabled: false,
          selectedAt: new Date().toISOString(),
        },
      },
    },
  })
}

export async function recordPendingWorkspaceCheckout(input: {
  companyId: string
  companyType: string
  planId: string
  seatCount?: number
  isolationEnabled?: boolean
  billingCycle?: BillingCycle
}) {
  const { key: workspaceType, pricing } = getWorkspacePricing(input.companyType)
  const plan = getWorkspacePlan(input.companyType, input.planId)
  if (!plan) throw new Error('Invalid plan for selected workspace type.')
  const seatCount = clampSeatCount(pricing, input.seatCount)
  const isolationEnabled = plan.isolationLocked ? false : input.isolationEnabled ?? getDefaultIsolation(plan)

  await prisma.company.update({
    where: { id: input.companyId },
    data: {
      planId: plan.id,
      billingType: pricing.billing,
      seatCount,
      isolationEnabled,
      isolationType: getIsolationType(isolationEnabled),
      billingInterval: input.billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY',
      metadata: {
        workspaceBilling: {
          billingCycle: input.billingCycle ?? 'monthly',
          billingType: pricing.billing,
          isolationEnabled,
          planId: plan.id,
          workspaceType,
        },
      },
    },
  })
}

