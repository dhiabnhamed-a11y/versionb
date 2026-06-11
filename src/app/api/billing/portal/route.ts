import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, type ApiParams } from '@/lib/api'
import { absoluteAppUrl, getCurrentWorkspaceSubscription } from '@/lib/billing-subscriptions'
import { getDodoClient, toDodoErrorMessage } from '@/lib/dodo'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute<ApiParams, unknown>(
req,
undefined,
async ({ user }) => {
  const subscription = await getCurrentWorkspaceSubscription(user.id)
  if (!subscription?.dodoCustomerId) return apiData({ error: 'No billing customer found.' }, { status: 404 }) as never

  try {
    const portal = await getDodoClient().customers.customerPortal.create(subscription.dodoCustomerId, {
      return_url: absoluteAppUrl('/account/billing'),
    })
    return apiData({ url: portal.link })
  } catch (error) {
    return apiData({ error: toDodoErrorMessage(error) }, { status: 502 }) as never
  }
},
{ auth: 'required', rateLimit: { max: 5, namespace: 'billing.portal.v2', windowMs: 60_000 }, route: '/api/billing/portal' }
)
}, { auth: 'required' });
