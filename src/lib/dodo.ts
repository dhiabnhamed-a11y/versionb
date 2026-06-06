import DodoPayments from 'dodopayments'
import type { CheckoutSessionResponse } from 'dodopayments/resources/checkout-sessions'
import type { PaymentListResponse } from 'dodopayments/resources/payments'
import type { Subscription } from 'dodopayments/resources/subscriptions'
import { calculateWorkspacePrice, getDodoProductId, getWorkspaceById, type BillingInterval } from '@/lib/pricing'

let dodoClient: DodoPayments | null = null

export type DodoClient = Pick<DodoPayments, 'checkoutSessions' | 'customers' | 'payments' | 'subscriptions' | 'webhooks'>

export type CreateCheckoutSessionParams = {
  workspaceId: string
  interval: BillingInterval
  quantity: number
  customerEmail: string
  successUrl: string
  cancelUrl: string
  customerName?: string
  userId?: string
  workspaceSubscriptionId?: string
}

export function getDodoApiKey() {
  return process.env.DODO_API_KEY ?? process.env.DODO_PAYMENTS_API_KEY
}

export function getDodoWebhookSecret() {
  return process.env.DODO_WEBHOOK_SECRET ?? process.env.DODO_PAYMENTS_WEBHOOK_KEY
}

export function getDodoClient() {
  if (!dodoClient) {
    const key = getDodoApiKey()
    if (!key) throw new Error('DODO_API_KEY is not set')
    dodoClient = new DodoPayments({
      bearerToken: key,
      environment: process.env.DODO_ENV === 'live' ? 'live_mode' : 'test_mode',
    })
  }
  return dodoClient
}

export function resetDodoClientForTests() {
  dodoClient = null
}

export function buildCheckoutMetadata(params: CreateCheckoutSessionParams) {
  const price = calculateWorkspacePrice({
    interval: params.interval,
    quantity: params.quantity,
    workspaceId: params.workspaceId,
  })

  return {
    billing_model: price.workspace.billingModel,
    interval: params.interval,
    quantity: String(price.displayQuantity),
    total_usd: String(price.total),
    unit_price_usd: String(price.unitPrice),
    user_id: params.userId ?? '',
    workspace_id: params.workspaceId,
    workspace_subscription_id: params.workspaceSubscriptionId ?? '',
  }
}

export async function createCheckoutSession(params: CreateCheckoutSessionParams, client: DodoClient = getDodoClient()) {
  const workspace = getWorkspaceById(params.workspaceId)
  if (!workspace) throw new Error('Invalid workspace.')

  const price = calculateWorkspacePrice({
    interval: params.interval,
    quantity: params.quantity,
    workspaceId: params.workspaceId,
  })
  const productId = getDodoProductId(params.workspaceId, params.interval)
  const product = {
    amount: params.interval === 'lifetime' ? Math.round(price.total * 100) : undefined,
    product_id: productId,
    quantity: price.billableQuantity,
  }

  const session: CheckoutSessionResponse = await client.checkoutSessions.create({
    cancel_url: params.cancelUrl,
    customer: {
      email: params.customerEmail,
      name: params.customerName,
    },
    metadata: buildCheckoutMetadata(params),
    product_cart: [product],
    return_url: params.successUrl,
    ...(params.interval === 'lifetime' ? {} : { subscription_data: { trial_period_days: 0 } }),
  })

  if (!session.checkout_url) throw new Error('Dodo checkout session returned no URL.')
  return {
    productId,
    sessionId: session.session_id,
    total: price.total,
    url: session.checkout_url,
  }
}

export async function retrieveDodoSubscription(subscriptionId: string): Promise<Subscription | null> {
  try {
    return await getDodoClient().subscriptions.retrieve(subscriptionId)
  } catch {
    return null
  }
}

export async function listDodoPayments(customerId: string, pageSize = 12): Promise<PaymentListResponse[]> {
  const payments = await getDodoClient().payments.list({ customer_id: customerId, page_size: pageSize })
  return payments.items
}

export function toDodoErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return 'Dodo Payments request failed.'
}
