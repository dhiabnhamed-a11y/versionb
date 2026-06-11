import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { logger } from '@/modules/shared/logger'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs' 

async function getRawBody(req: NextRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  const reader = req.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export const POST = withApiHandler(async ({ req, params }) => {
const rawBody = await getRawBody(req)
const signature = req.headers.get('stripe-signature')
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

if (!signature || !webhookSecret) {
logger.warn('stripe.webhook_missing_signature')
return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
}

let event: Stripe.Event

try {
const stripe = getStripe()
event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
} catch (err) {
logger.warn('stripe.webhook_signature_failed', { error: String(err) })
return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
}

const companyId = extractCompanyIdFromEvent(event) ?? 'stripe-webhook'

const existingEvent = await prisma.idempotencyKey.findUnique({
  where: { companyId_key: { companyId, key: event.id } },
})

if (existingEvent) {
logger.info('stripe.webhook_duplicate', { eventId: event.id, type: event.type })
return NextResponse.json({ received: true, duplicate: true })
}

await prisma.idempotencyKey.create({
data: {
  key: event.id,
  companyId,
  method: 'WEBHOOK',
  route: 'stripe',
  bodyHash: event.id,
  status: 'PROCESSING',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
},
})

try {
await handleStripeEvent(event)

await prisma.idempotencyKey.update({
  where: { companyId_key: { companyId, key: event.id } },
  data: { status: 'COMPLETED', response: { type: event.type, status: 'completed' } },
})

return NextResponse.json({ received: true })
} catch (err) {
logger.error('stripe.webhook_processing_failed', { eventId: event.id, type: event.type, error: String(err) })

await prisma.idempotencyKey.update({
  where: { companyId_key: { companyId, key: event.id } },
  data: { status: 'FAILED', error: String(err) },
})

return NextResponse.json({ received: true, error: 'Processing failed' })
}
}, { auth: 'required' });

function extractCompanyIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as Record<string, unknown>
  return (
    (obj.metadata as Record<string, string> | undefined)?.companyId ??
    (obj.subscription_data as Record<string, unknown> | undefined)?.metadata as string | null ??
    null
  )
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const companyId = session.metadata?.companyId
      if (!companyId) throw new Error('Missing companyId in checkout session metadata')

      await prisma.company.update({
        where: { id: companyId },
        data: {
          subscriptionStatus: 'ACTIVE',
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          planType: 'STARTER', 
        },
      })
      logger.info('stripe.checkout_completed', { companyId })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const companyId = (invoice.subscription_details?.metadata as Record<string, string>)?.companyId
      if (!companyId) break

      await prisma.company.update({
        where: { id: companyId },
        data: { subscriptionStatus: 'PAST_DUE' },
      })
      logger.warn('stripe.payment_failed', { companyId, invoiceId: invoice.id })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const companyId = (sub.metadata as Record<string, string>)?.companyId
      if (!companyId) break

      await prisma.company.update({
        where: { id: companyId },
        data: { subscriptionStatus: 'CANCELED' },
      })
      logger.info('stripe.subscription_cancelled', { companyId })
      break
    }

    default:
      logger.info('stripe.webhook_unhandled', { type: event.type })
  }
}
