import { NextRequest, NextResponse } from 'next/server'
import DodoPayments from 'dodopayments'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'
import {
  getDefaultPlanForWorkspace,
  getIsolationType,
  getWorkspacePlan,
  getWorkspacePricing,
  getWorkspacePricingKey,
} from '@/lib/workspace-pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DodoMetadataSchema = z.object({
  workspace_type: z.string().optional(),
  workspace_id: z.string().optional(),
  companyId: z.string().optional(),
  plan_id: z.string().optional(),
  planKey: z.string().optional(),
  seat_count: z.string().optional(),
  seats: z.string().optional(),
  isolation_enabled: z.enum(['true', 'false']).optional(),
  billing_cycle: z.enum(['monthly', 'annual']).optional(),
})

type DodoWebhookEvent = {
  type: string
  data: Record<string, unknown>
}

type DodoMetadata = z.infer<typeof DodoMetadataSchema>

function getString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function getMetadata(data: Record<string, unknown>): DodoMetadata {
  const metadata = data.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  const parsed = DodoMetadataSchema.safeParse(metadata)
  return parsed.success ? parsed.data : {}
}

function getCustomerId(data: Record<string, unknown>) {
  const customer = data.customer
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) return undefined
  return getString((customer as Record<string, unknown>).customer_id) ?? undefined
}

function getSubscriptionId(eventType: string, data: Record<string, unknown>) {
  const explicitSubscriptionId = getString(data.subscription_id)
  if (explicitSubscriptionId) return explicitSubscriptionId
  return eventType.startsWith('subscription.') ? getString(data.id) ?? undefined : undefined
}

function getSeatCount(data: Record<string, unknown>, metadata: DodoMetadata) {
  const raw = Number(data.plan_qty ?? data.quantity ?? metadata.seat_count ?? metadata.seats ?? 1)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1
}

function getDate(value: unknown) {
  const raw = getString(value)
  if (!raw) return undefined
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? undefined : date
}

async function loadWorkspaceFromMetadata(metadata: DodoMetadata) {
  const workspaceId = metadata.workspace_id ?? metadata.companyId
  const workspaceType = metadata.workspace_type
  if (!workspaceId || !workspaceType) return null

  const company = await prisma.company.findUnique({
    where: { id: workspaceId },
    select: { id: true, companyType: true, planId: true, isolationEnabled: true, metadata: true },
  })
  if (!company) return null
  if (getWorkspacePricingKey(company.companyType) !== workspaceType) return null
  return company
}

export async function POST(req: NextRequest) {
  const rl = await enforceDistributedRateLimit(req, {
    namespace: 'billing.webhook',
    windowMs: 60_000,
    max: 120,
  })
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY
  const rawBody = await req.text().catch(() => null)
  if (!rawBody) return NextResponse.json({ error: 'Failed to read body.' }, { status: 400 })

  const dodo = new DodoPayments({
    webhookKey: webhookKey ?? undefined,
    environment: process.env.DODO_ENV === 'live' ? 'live_mode' : 'test_mode',
  })

  let event: DodoWebhookEvent
  try {
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })
    event = dodo.webhooks.unwrap(rawBody, { headers, key: webhookKey ?? undefined }) as unknown as DodoWebhookEvent
  } catch (error) {
    console.error('[billing/dodo-webhook] Verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    const data = event.data
    const metadata = getMetadata(data)
    const company = await loadWorkspaceFromMetadata(metadata)
    if (!company) {
      return NextResponse.json({ received: true, ignored: true })
    }

    const { pricing } = getWorkspacePricing(company.companyType)
    const planId = metadata.plan_id ?? metadata.planKey ?? company.planId ?? getDefaultPlanForWorkspace(company.companyType).id
    const plan = getWorkspacePlan(company.companyType, planId) ?? getDefaultPlanForWorkspace(company.companyType)
    const seatCount = getSeatCount(data, metadata)
    const isolationEnabled = metadata.isolation_enabled === 'true'
    const subscriptionId = getSubscriptionId(event.type, data)
    const nextBillingDate = getDate(data.next_billing_date)
    const existingMetadata =
      company.metadata && typeof company.metadata === 'object' && !Array.isArray(company.metadata)
        ? (company.metadata as Record<string, unknown>)
        : {}

    switch (event.type) {
      case 'checkout.completed':
      case 'payment.succeeded':
      case 'subscription.active':
      case 'subscription.renewed':
      case 'subscription.plan_changed':
      case 'subscription.updated': {
        const isolationChanged = company.isolationEnabled !== isolationEnabled
        await prisma.$transaction([
          prisma.company.update({
            where: { id: company.id },
            data: {
              billingInterval: metadata.billing_cycle === 'annual' ? 'YEARLY' : 'MONTHLY',
              billingType: pricing.billing,
              currentPeriodEnd: nextBillingDate,
              isolationEnabled,
              isolationType: getIsolationType(isolationEnabled),
              nextBillingDate,
              planId: plan.id,
              planType: 'STARTER',
              seatCount,
              stripeCustomerId: getCustomerId(data),
              stripeSubscriptionId: subscriptionId,
              subscriptionId,
              subscriptionStatus: 'ACTIVE',
            },
          }),
          prisma.subscriptionEvent.create({
            data: {
              companyId: company.id,
              event: event.type === 'payment.succeeded' ? 'invoice_payment_succeeded' : 'subscription_updated',
              payload: {
                isolationChanged,
                isolationEnabled,
                planId: plan.id,
                provider: 'dodo',
                seats: seatCount,
                subscriptionId,
                workspaceType: metadata.workspace_type,
              },
            },
          }),
        ])
        break
      }

      case 'subscription.cancelled':
      case 'subscription.expired': {
        const retentionEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        const defaultPlan = getDefaultPlanForWorkspace(company.companyType)
        await prisma.$transaction([
          prisma.company.update({
            where: { id: company.id },
            data: {
              planId: defaultPlan.id,
              planType: 'FREE_TRIAL',
              subscriptionStatus: 'CANCELED',
              metadata: {
                ...existingMetadata,
                dataRetentionEndsAt: retentionEndsAt.toISOString(),
                workspaceBilling: {
                  ...(existingMetadata.workspaceBilling &&
                  typeof existingMetadata.workspaceBilling === 'object' &&
                  !Array.isArray(existingMetadata.workspaceBilling)
                    ? (existingMetadata.workspaceBilling as Record<string, unknown>)
                    : {}),
                  cancelledAt: new Date().toISOString(),
                  provider: 'dodo',
                  subscriptionId,
                },
              },
            },
          }),
          prisma.subscriptionEvent.create({
            data: {
              companyId: company.id,
              event: 'subscription_canceled',
              payload: { dataRetentionEndsAt: retentionEndsAt.toISOString(), provider: 'dodo', subscriptionId },
            },
          }),
        ])
        break
      }

      case 'payment.failed':
      case 'subscription.failed': {
        const gracePeriodEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await prisma.$transaction([
          prisma.company.update({
            where: { id: company.id },
            data: {
              subscriptionStatus: 'PAST_DUE',
              metadata: {
                ...existingMetadata,
                gracePeriodEndsAt: gracePeriodEndsAt.toISOString(),
                workspaceBilling: {
                  ...(existingMetadata.workspaceBilling &&
                  typeof existingMetadata.workspaceBilling === 'object' &&
                  !Array.isArray(existingMetadata.workspaceBilling)
                    ? (existingMetadata.workspaceBilling as Record<string, unknown>)
                    : {}),
                  paymentFailedAt: new Date().toISOString(),
                  provider: 'dodo',
                  subscriptionId,
                },
              },
            },
          }),
          prisma.subscriptionEvent.create({
            data: {
              companyId: company.id,
              event: 'invoice_payment_failed',
              payload: { gracePeriodEndsAt: gracePeriodEndsAt.toISOString(), provider: 'dodo', subscriptionId },
            },
          }),
        ])
        break
      }

      default:
        break
    }
  } catch (error) {
    console.error(`[billing/dodo-webhook] Error handling event ${event.type}:`, error)
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
