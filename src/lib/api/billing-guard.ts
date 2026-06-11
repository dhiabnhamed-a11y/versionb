import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getAuthSecret } from '@/lib/env'
import { hasFeature } from '@/lib/entitlements'

type BillingGuardOptions = {
  feature: string
  blockTrial?: boolean
}

type RouteHandler = (req: NextRequest, ctx: unknown) => Promise<NextResponse>

export function withBillingGuard(
  handler: RouteHandler,
  options: BillingGuardOptions
): RouteHandler {
  return async (req: NextRequest, ctx: unknown): Promise<NextResponse> => {
    const token = await getToken({ req, secret: getAuthSecret('billing-guard') })

    if (!token?.companyId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const companyId = token.companyId as string
    const subscriptionStatus = token.subscriptionStatus as string | undefined

    if (options.blockTrial && subscriptionStatus && !['ACTIVE'].includes(subscriptionStatus)) {
      return NextResponse.json(
        { error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED', feature: options.feature },
        { status: 402 }
      )
    }

    const allowed = await hasFeature(companyId, options.feature)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Feature not available on your current plan', code: 'FEATURE_NOT_ENTITLED', feature: options.feature, upgradeUrl: '/billing/upgrade' },
        { status: 403 }
      )
    }

    return handler(req, ctx)
  }
}
