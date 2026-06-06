import { NextRequest, NextResponse } from 'next/server'
import DodoPayments from 'dodopayments'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  mapDodoSubscriptionStatus,
  parseDodoDate,
  syncCompanyBillingFromSubscription,
  type WorkspaceSubscriptionStatus,
} from '@/lib/billing-subscriptions'
import { getDodoWebhookSecret } from '@/lib/dodo'
import { getWorkspaceById, type BillingInterval } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DodoWebhookEvent = {
  type: string
  data: Record<string, unknown>
}

function getString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function getObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function getMetadata(data: Record<string, unknown>) {
  return getObject(data.metadata)
}

function getCustomerId(data: Record<string, unknown>) {
  const direct = getString(data.customer_id)
  if (direct) return direct
  return getString(getObject(data.customer).customer_id)
}

function getSubscriptionId(eventType: string, data: Record<string, unknown>) {
  return getString(data.subscription_id) ?? (eventType.startsWith('subscription.') ? getString(data.id) : null)
}

function getInterval(metadata: Record<string, unknown>, data: Record<string, unknown>): BillingInterval {
  const raw = getString(metadata.interval) ?? getString(metadata.billing_cycle)
  if (raw === 'annual' || raw === 'lifetime') return raw
  if (getString(data.payment_frequency_interval) === 'Year') return 'annual'
  return 'monthly'
}

function getSeatCount(metadata: Record<string, unknown>, data: Record<string, unknown>) {
  const raw = Number(metadata.quantity ?? metadata.seat_count ?? data.quantity ?? 1)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1
}

async function loadWorkspaceSubscription(metadata: Record<string, unknown>, data: Record<string, unknown>, eventType: string) {
  const workspaceSubscriptionId = getString(metadata.workspace_subscription_id)
  if (workspaceSubscriptionId) {
    const subscription = await prisma.workspaceSubscription.findUnique({ where: { id: workspaceSubscriptionId } })
    if (subscription) return subscription
  }

  const dodoSubscriptionId = getSubscriptionId(eventType, data)
  if (dodoSubscriptionId) {
    const subscription = await prisma.workspaceSubscription.findFirst({ where: { dodoSubscriptionId } })
    if (subscription) return subscription
  }

  const userId = getString(metadata.user_id)
  if (userId) {
    return prisma.workspaceSubscription.findFirst({ orderBy: { createdAt: 'desc' }, where: { userId } })
  }

  return null
}

async function recordCompanyEvent(userId: string, event: string, payload: Record<string, unknown>) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } })
  if (!user?.companyId) return
  await prisma.subscriptionEvent.create({ data: { companyId: user.companyId, event, payload: payload as Prisma.InputJsonValue } })
}

export async function POST(req: NextRequest) {
  const webhookSecret = getDodoWebhookSecret()
  const rawBody = await req.text().catch(() => null)
  if (!rawBody) return NextResponse.json({ error: 'Failed to read body.' }, { status: 400 })

  const dodo = new DodoPayments({
    environment: process.env.DODO_ENV === 'live' ? 'live_mode' : 'test_mode',
    webhookKey: webhookSecret ?? undefined,
  })

  let event: DodoWebhookEvent
  try {
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })
    event = dodo.webhooks.unwrap(rawBody, { headers, key: webhookSecret ?? undefined }) as unknown as DodoWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  const data = getObject(event.data)
  const metadata = getMetadata(data)
  const existing = await loadWorkspaceSubscription(metadata, data, event.type)
  if (!existing) return NextResponse.json({ received: true, ignored: true })

  const workspaceId = getString(metadata.workspace_id) ?? existing.workspaceId
  const workspace = getWorkspaceById(workspaceId)
  if (!workspace) return NextResponse.json({ received: true, ignored: true })

  const interval = getInterval(metadata, data)
  const seatCount = getSeatCount(metadata, data)
  const dodoCustomerId = getCustomerId(data) ?? existing.dodoCustomerId
  const dodoSubscriptionId = getSubscriptionId(event.type, data) ?? existing.dodoSubscriptionId
  const currentPeriodEnd = parseDodoDate(data.next_billing_date) ?? parseDodoDate(data.current_period_end) ?? existing.currentPeriodEnd
  const currentPeriodStart = parseDodoDate(data.previous_billing_date) ?? existing.currentPeriodStart

  let status: WorkspaceSubscriptionStatus = existing.status as WorkspaceSubscriptionStatus
  if (event.type === 'payment.succeeded') status = 'active'
  if (event.type === 'subscription.updated') status = mapDodoSubscriptionStatus(getString(data.status) ?? 'active')
  if (event.type === 'subscription.cancelled') status = 'cancelled'
  if (event.type === 'payment.failed') status = 'past_due'

  const updated = await prisma.workspaceSubscription.update({
    where: { id: existing.id },
    data: {
      billingModel: workspace.billingModel,
      currentPeriodEnd,
      currentPeriodStart,
      dodoCustomerId,
      dodoSubscriptionId,
      interval,
      seatCount,
      status,
      workspaceId,
      ...(status === 'cancelled' ? { cancelledAt: new Date() } : {}),
    },
  })

  await syncCompanyBillingFromSubscription({
    billingModel: workspace.billingModel,
    currentPeriodEnd: updated.currentPeriodEnd,
    dodoCustomerId: updated.dodoCustomerId,
    dodoSubscriptionId: updated.dodoSubscriptionId,
    interval: updated.interval as BillingInterval,
    seatCount: updated.seatCount,
    status,
    userId: updated.userId,
    workspaceId: updated.workspaceId,
  })

  await recordCompanyEvent(updated.userId, event.type.replace(/\./g, '_'), {
    dodoCustomerId,
    dodoSubscriptionId,
    interval,
    seatCount,
    workspaceId,
  })

  return NextResponse.json({ received: true })
}
