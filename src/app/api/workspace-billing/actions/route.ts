import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, type ApiParams } from '@/lib/api'
import { prisma } from '@/lib/db'
import { createDodoWorkspaceCheckout, getDodoWorkspaceClient } from '@/lib/dodo-workspace-billing'
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
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute<ApiParams, unknown>(
req,
undefined,
async ({ user }) => {
  const body = (await req.json().catch(() => ({}))) as {
    workspaceId?: string
    action?: 'change_plan' | 'seat_change' | 'isolation_change' | 'billing_email'
    planId?: string
    seatCount?: number
    isolationEnabled?: boolean
    billingCycle?: string
    confirmed?: boolean
    billingEmail?: string
  }

  if (!user.companyId || body.workspaceId !== user.companyId) {
    return apiData({ error: 'Billing actions are only available inside this workspace.' }, { status: 403 }) as never
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: {
      id: true,
      companyType: true,
      metadata: true,
      name: true,
      owner: { select: { email: true, name: true } },
      planId: true,
      seatCount: true,
      isolationEnabled: true,
      subscriptionId: true,
      stripeSubscriptionId: true,
    },
  })
  if (!company) return apiData({ error: 'Workspace not found.' }, { status: 404 }) as never

  const { key: workspaceType, pricing } = getWorkspacePricing(company.companyType)
  const billingCycle: BillingCycle = body.billingCycle === 'annual' ? 'annual' : 'monthly'
  const metadata = asObject(company.metadata)
  const subscriptionId = company.subscriptionId ?? company.stripeSubscriptionId

  if (body.action === 'billing_email') {
    const billingEmail = body.billingEmail?.trim().toLowerCase()
    if (!billingEmail || !billingEmail.includes('@')) {
      return apiData({ error: 'Enter a valid billing email.' }, { status: 400 }) as never
    }
    await prisma.company.update({
      where: { id: company.id },
      data: { metadata: { ...metadata, billingEmail } },
    })
    return apiData({ ok: true, billingEmail }, { code: 'BILLING_EMAIL_UPDATED' })
  }

  if (body.action === 'isolation_change') {
    const enabled = Boolean(body.isolationEnabled)
    if (!enabled && !body.confirmed) {
      return apiData({ error: 'Confirmation is required before disabling isolation.' }, { status: 400 }) as never
    }
    await prisma.$transaction([
      prisma.company.update({
        where: { id: company.id },
        data: {
          isolationEnabled: enabled,
          isolationType: getIsolationType(enabled),
          metadata: {
            ...metadata,
            workspaceBilling: {
              ...asObject(metadata.workspaceBilling),
              isolationEnabled: enabled,
              isolationUpdatedAt: new Date().toISOString(),
            },
          },
        },
      }),
      prisma.subscriptionEvent.create({
        data: {
          companyId: company.id,
          event: 'isolation_updated',
          payload: { isolationEnabled: enabled, provider: 'dodo', workspaceType },
        },
      }),
    ])
    return apiData({ ok: true }, { code: 'ISOLATION_UPDATED' })
  }

  const nextPlan = getWorkspacePlan(company.companyType, body.planId ?? company.planId)
  if (!nextPlan) return apiData({ error: 'Invalid plan for this workspace type.' }, { status: 400 }) as never
  const seatCount = isFreePlan(nextPlan)
    ? nextPlan.seats ?? 1
    : clampSeatCount(pricing, body.seatCount ?? company.seatCount)
  const isolationEnabled = nextPlan.isolationLocked
    ? false
    : body.isolationEnabled ?? company.isolationEnabled ?? getDefaultIsolation(nextPlan)
  const totals = calculateWorkspacePlanTotal({ billingCycle, isolationEnabled, plan: nextPlan, pricing, seatCount })

  if (body.action === 'seat_change' && pricing.billing !== 'per-seat') {
    return apiData({ error: 'Seat changes are only available for per-seat workspaces.' }, { status: 400 }) as never
  }

  if (subscriptionId && !isFreePlan(nextPlan) && process.env.DODO_PAYMENTS_API_KEY) {
    const dodo = getDodoWorkspaceClient()
    await dodo.subscriptions.changePlan(subscriptionId, {
      product_id: nextPlan.id,
      quantity: totals.quantity,
      proration_billing_mode: 'prorated_immediately',
      metadata: {
        workspace_id: company.id,
        workspace_type: workspaceType,
        plan_id: nextPlan.id,
        seat_count: String(seatCount),
        isolation_enabled: String(isolationEnabled),
        billing_cycle: billingCycle,
      },
    })
  } else if (!subscriptionId && !isFreePlan(nextPlan)) {
    const checkout = await createDodoWorkspaceCheckout({
      billingCycle,
      companyId: company.id,
      companyType: company.companyType,
      customerEmail: company.owner.email,
      customerName: company.owner.name,
      isolationEnabled,
      planId: nextPlan.id,
      seatCount,
    })
    return apiData({ url: checkout?.url }, { code: 'CHECKOUT_REQUIRED' })
  }

  await prisma.$transaction([
    prisma.company.update({
      where: { id: company.id },
      data: {
        planId: nextPlan.id,
        billingType: pricing.billing,
        seatCount,
        isolationEnabled,
        isolationType: getIsolationType(isolationEnabled),
        billingInterval: billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY',
        planType: isFreePlan(nextPlan) ? 'FREE_TRIAL' : 'STARTER',
        metadata: {
          ...metadata,
          workspaceBilling: {
            ...asObject(metadata.workspaceBilling),
            billingCycle,
            billingType: pricing.billing,
            isolationEnabled,
            planId: nextPlan.id,
            workspaceType,
          },
        },
      },
    }),
    prisma.subscriptionEvent.create({
      data: {
        companyId: company.id,
        event: body.action === 'seat_change' ? 'seats_updated' : 'subscription_updated',
        payload: {
          billingCycle,
          isolationEnabled,
          planId: nextPlan.id,
          provider: 'dodo',
          seats: seatCount,
          workspaceType,
        },
      },
    }),
  ])

  return apiData({ ok: true }, { code: 'WORKSPACE_BILLING_UPDATED' })
},
{
  auth: 'required',
  rateLimit: { max: 12, namespace: 'workspace.billing.actions', windowMs: 60_000 },
  responseMode: 'canonical',
  route: '/api/workspace-billing/actions',
}
)
}, { auth: 'required' });
