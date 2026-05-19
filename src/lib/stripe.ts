import Stripe from 'stripe'
import { prisma } from '@/lib/db'
import type { BillingInterval } from '@prisma/client'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    _stripe = new Stripe(key, { apiVersion: '2024-04-10' })
  }
  return _stripe
}

export async function getStripeCustomer(companyId: string): Promise<string> {
  const stripe = getStripe()

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, stripeCustomerId: true, owner: { select: { email: true } } },
  })

  if (!company) throw new Error('Company not found')

  if (company.stripeCustomerId) {
    return company.stripeCustomerId
  }

  const customer = await stripe.customers.create({
    name: company.name,
    email: company.owner.email,
    metadata: { companyId },
  })

  await prisma.company.update({
    where: { id: companyId },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}

export function getSeatPrice(interval: BillingInterval): string {
  if (interval === 'MONTHLY') {
    const id = process.env.STRIPE_PRICE_MONTHLY
    if (!id) throw new Error('STRIPE_PRICE_MONTHLY is not set')
    return id
  }
  if (interval === 'YEARLY') {
    const id = process.env.STRIPE_PRICE_YEARLY
    if (!id) throw new Error('STRIPE_PRICE_YEARLY is not set')
    return id
  }
  if (interval === 'LIFETIME') {
    const id = process.env.STRIPE_PRICE_LIFETIME
    if (!id) throw new Error('STRIPE_PRICE_LIFETIME is not set')
    return id
  }
  throw new Error(`Unknown billing interval: ${interval}`)
}
