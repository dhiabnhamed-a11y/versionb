import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedSuperAdminIdentity } from '@/lib/security'
import type { PlanType, SubscriptionStatus } from '@prisma/client'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

async function trySetLifetimeBillingInterval(companyId: string) {
  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { billingInterval: 'LIFETIME' },
    })
    return null
  } catch (error) {
    console.warn('grant-lifetime billingInterval update skipped:', error)
    return 'Lifetime access was granted, but billingInterval could not be set. Run the BillingInterval enum migration.'
  }
}

export const POST = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
if (!user.id || !isAuthorizedSuperAdminIdentity(user)) {
return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

try {
const body = (await req.json()) as { companyId?: string; enable?: boolean }

if (!body.companyId) {
  return NextResponse.json({ error: 'companyId is required.' }, { status: 400 })
}

const company = await prisma.company.findUnique({
  where: { id: body.companyId },
  select: { id: true, status: true, planType: true },
})

if (!company) {
  return NextResponse.json({ error: 'Company not found.' }, { status: 404 })
}

if (company.status !== 'ACTIVE') {
  return NextResponse.json({ error: 'Only active companies can receive lifetime grants.' }, { status: 400 })
}

const enable = body.enable !== false

if (enable) {
  if (company.planType === 'LIFETIME') {
    return NextResponse.json({ error: 'Company already has a lifetime subscription.' }, { status: 409 })
  }

  await prisma.company.update({
    where: { id: body.companyId },
    data: {
      planType: 'LIFETIME' as PlanType,
      subscriptionStatus: 'ACTIVE' as SubscriptionStatus,
    },
  })
  const warning = await trySetLifetimeBillingInterval(body.companyId)
  return NextResponse.json({ success: true, warning })
} else {
  if (company.planType !== 'LIFETIME') {
    return NextResponse.json({ error: 'Company does not have a lifetime subscription.' }, { status: 409 })
  }

  await prisma.company.update({
    where: { id: body.companyId },
    data: {
      planType: 'FREE_TRIAL' as PlanType,
      subscriptionStatus: 'ACTIVE' as SubscriptionStatus,
      billingInterval: null,
    },
  })
}

return NextResponse.json({ success: true })
} catch (error) {
console.error('grant-lifetime error:', error)
return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to grant lifetime subscription.' }, { status: 500 })
}
}, { auth: 'required' });
