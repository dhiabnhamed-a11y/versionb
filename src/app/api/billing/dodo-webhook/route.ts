import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { BillingInterval, PlanType, SubscriptionStatus } from '@prisma/client'
import DodoPayments from 'dodopayments'

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

function getPlanInfo(metadata?: Record<string, string> | null) {
  const planKey = metadata?.planKey ?? ''
  return {
    planType: (PLAN_KEY_TO_PLAN_TYPE[planKey] ?? 'STARTER') as PlanType,
    billingInterval: (PLAN_KEY_TO_INTERVAL[planKey] ?? 'MONTHLY') as BillingInterval,
    seats: Number(metadata?.seats ?? 1),
  }
}

export async function POST(req: NextRequest) {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY

  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read body.' }, { status: 400 })
  }

  const dodo = new DodoPayments({
    webhookKey: webhookKey ?? undefined,
    environment: process.env.DODO_ENV === 'live' ? 'live_mode' : 'test_mode',
  })

  let event: { type: string; data: Record<string, unknown> }
  try {
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => { headers[key.toLowerCase()] = value })
    const result = dodo.webhooks.unwrap(rawBody, { headers, key: webhookKey ?? undefined })
    event = result as unknown as { type: string; data: Record<string, unknown> }
  } catch (err) {
    console.error('[billing/dodo-webhook] Verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment.succeeded': {
        const data = event.data as { metadata?: Record<string, string>; customer?: { customer_id?: string }; id: string }
        const companyId = data.metadata?.companyId
        if (companyId) {
          const planInfo = getPlanInfo(data.metadata)
          await prisma.$transaction([
            prisma.company.update({
              where: { id: companyId },
              data: {
                subscriptionStatus: 'ACTIVE' as SubscriptionStatus,
                stripeCustomerId: data.customer?.customer_id ?? undefined,
                stripeSubscriptionId: null,
                planType: planInfo.planType,
                billingInterval: planInfo.billingInterval,
                seatCount: planInfo.seats,
              },
            }),
            prisma.subscriptionEvent.create({
              data: {
                companyId,
                event: 'subscription_created',
                payload: { planKey: data.metadata?.planKey, seats: planInfo.seats, paymentId: data.id, provider: 'dodo' },
              },
            }),
          ])
        }
        break
      }

      case 'subscription.active':
      case 'subscription.renewed': {
        const data = event.data as { id: string; metadata?: Record<string, string>; customer?: { customer_id?: string }; plan_qty?: number }
        const companyId = data.metadata?.companyId
        if (companyId) {
          const planInfo = getPlanInfo(data.metadata)
          await prisma.$transaction([
            prisma.company.update({
              where: { id: companyId },
              data: {
                subscriptionStatus: 'ACTIVE' as SubscriptionStatus,
                stripeCustomerId: data.customer?.customer_id ?? undefined,
                stripeSubscriptionId: data.id,
                planType: planInfo.planType,
                billingInterval: planInfo.billingInterval,
                seatCount: data.plan_qty ?? planInfo.seats,
              },
            }),
            prisma.subscriptionEvent.create({
              data: {
                companyId,
                event: 'subscription_created',
                payload: { subscriptionId: data.id, provider: 'dodo' },
              },
            }),
          ])
        }
        break
      }

      case 'subscription.cancelled':
      case 'subscription.expired': {
        const data = event.data as { id: string; metadata?: Record<string, string> }
        const companyId = data.metadata?.companyId
        if (companyId) {
          await prisma.$transaction([
            prisma.company.update({
              where: { id: companyId },
              data: { subscriptionStatus: 'CANCELED' as SubscriptionStatus },
            }),
            prisma.subscriptionEvent.create({
              data: { companyId, event: 'subscription_canceled', payload: { subscriptionId: data.id, provider: 'dodo' } },
            }),
          ])
        }
        break
      }

      case 'subscription.updated': {
        const data = event.data as { id: string; metadata?: Record<string, string>; plan_qty?: number }
        const companyId = data.metadata?.companyId
        if (companyId) {
          await prisma.company.update({
            where: { id: companyId },
            data: { seatCount: data.plan_qty ?? 1 },
          })
        }
        break
      }

      case 'payment.failed':
      case 'subscription.failed': {
        const data = event.data as { metadata?: Record<string, string> }
        const companyId = data.metadata?.companyId
        if (companyId) {
          await prisma.$transaction([
            prisma.company.update({
              where: { id: companyId },
              data: { subscriptionStatus: 'PAST_DUE' as SubscriptionStatus },
            }),
            prisma.subscriptionEvent.create({
              data: { companyId, event: 'invoice_payment_failed', payload: { provider: 'dodo' } },
            }),
          ])
        }
        break
      }

      default:
        break
    }
  } catch (error) {
    console.error(`[billing/dodo-webhook] Error handling event ${event.type}:`, error)
  }

  return NextResponse.json({ received: true })
}
