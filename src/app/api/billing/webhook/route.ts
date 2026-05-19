import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import type { BillingInterval, PlanType, SubscriptionStatus } from '@prisma/client'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAN_KEY_TO_PLAN_TYPE: Record<string, PlanType> = {
  STARTER_MONTHLY: 'STARTER',
  STARTER_YEARLY: 'STARTER',
  TEAM_MONTHLY: 'TEAM',
  LIFETIME: 'LIFETIME',
}

const PLAN_KEY_TO_INTERVAL: Record<string, BillingInterval> = {
  STARTER_MONTHLY: 'MONTHLY',
  STARTER_YEARLY: 'YEARLY',
  TEAM_MONTHLY: 'MONTHLY',
  LIFETIME: 'LIFETIME',
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const companyId = session.metadata?.companyId
  const planKey = session.metadata?.planKey
  const seats = Number(session.metadata?.seats ?? 1)

  if (!companyId) return

  const planType: PlanType = planKey ? (PLAN_KEY_TO_PLAN_TYPE[planKey] ?? 'STARTER') : 'STARTER'
  const billingInterval: BillingInterval = planKey ? (PLAN_KEY_TO_INTERVAL[planKey] ?? 'MONTHLY') : 'MONTHLY'

  const rawSession = session as unknown as { subscription?: string | { id: string } | null }
  const subscriptionId =
    typeof rawSession.subscription === 'string' ? rawSession.subscription : rawSession.subscription?.id ?? null

  let currentPeriodEnd: Date | null = null

  if (subscriptionId) {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    currentPeriodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000)
  }

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: {
        subscriptionStatus: 'ACTIVE' as SubscriptionStatus,
        stripeSubscriptionId: subscriptionId,
        planType,
        billingInterval,
        seatCount: seats,
        currentPeriodEnd,
      },
    }),
    prisma.subscriptionEvent.create({
      data: {
        companyId,
        event: 'subscription_created',
        payload: { planKey, seats, subscriptionId, currentPeriodEnd: currentPeriodEnd?.toISOString() },
      },
    }),
  ])
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const raw = invoice as unknown as { subscription?: string | { id: string } | null }
  const subscriptionId =
    typeof raw.subscription === 'string' ? raw.subscription : raw.subscription?.id ?? null
  if (!subscriptionId) return

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const companyId = subscription.metadata?.companyId
  if (!companyId) return

  const currentPeriodEnd = new Date(
    (subscription as unknown as { current_period_end: number }).current_period_end * 1000,
  )

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { currentPeriodEnd, subscriptionStatus: 'ACTIVE' as SubscriptionStatus },
    }),
    prisma.subscriptionEvent.create({
      data: {
        companyId,
        event: 'invoice_payment_succeeded',
        payload: { invoiceId: invoice.id, currentPeriodEnd: currentPeriodEnd.toISOString() },
      },
    }),
  ])
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const raw = invoice as unknown as { subscription?: string | { id: string } | null }
  const subscriptionId =
    typeof raw.subscription === 'string' ? raw.subscription : raw.subscription?.id ?? null
  if (!subscriptionId) return

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const companyId = subscription.metadata?.companyId
  if (!companyId) return

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { subscriptionStatus: 'PAST_DUE' as SubscriptionStatus },
    }),
    prisma.subscriptionEvent.create({
      data: {
        companyId,
        event: 'invoice_payment_failed',
        payload: { invoiceId: invoice.id },
      },
    }),
  ])
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const companyId = subscription.metadata?.companyId
  if (!companyId) return

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { subscriptionStatus: 'CANCELED' as SubscriptionStatus },
    }),
    prisma.subscriptionEvent.create({
      data: {
        companyId,
        event: 'subscription_canceled',
        payload: { subscriptionId: subscription.id },
      },
    }),
  ])
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const companyId = subscription.metadata?.companyId
  if (!companyId) return

  const currentPeriodEnd = new Date(
    (subscription as unknown as { current_period_end: number }).current_period_end * 1000,
  )
  const quantity = (subscription as unknown as { items: { data: { quantity?: number }[] } }).items?.data?.[0]?.quantity ?? 1

  await prisma.company.update({
    where: { id: companyId },
    data: { seatCount: quantity, currentPeriodEnd },
  })
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret.' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const rawBody = await req.text()
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[billing/webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      default:
        break
    }
  } catch (error) {
    console.error(`[billing/webhook] Error handling event ${event.type}:`, error)
  }

  return NextResponse.json({ received: true })
}
