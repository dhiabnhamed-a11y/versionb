import { NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'
import { getPaymentAdapter } from '@/lib/payments/provider'
import type { PaymentProviderName } from '@/lib/payments/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = user.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'No company associated with your account.' }, { status: 400 })
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { stripeCustomerId: true, stripeSubscriptionId: true },
  })

  if (!company?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account found. Please subscribe first.' }, { status: 404 })
  }

  try {
    const provider: PaymentProviderName = company.stripeSubscriptionId ? 'stripe' : 'dodo'
    const adapter = getPaymentAdapter(provider)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

    const result = await adapter.createPortalSession({
      companyId,
      returnUrl: `${appUrl}/billing`,
    })

    return NextResponse.json({ url: result.url })
  } catch (error) {
    console.error('[billing/portal]', error)
    return NextResponse.json({ error: 'Failed to create billing portal session.' }, { status: 500 })
  }
}
