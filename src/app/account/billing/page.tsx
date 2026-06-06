import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getDodoClient } from '@/lib/dodo'
import AccountBillingClient from '@/components/billing/AccountBillingClient'

async function getPaymentMethod(customerId: string | null) {
  if (!customerId) return null
  try {
    const methods = await getDodoClient().customers.retrievePaymentMethods(customerId)
    const card = methods.items.find((item) => item.card)?.card
    if (!card) return null
    return {
      brand: card.card_network ?? null,
      expiry: card.expiry_month && card.expiry_year ? `${card.expiry_month}/${card.expiry_year}` : null,
      last4: card.last4_digits ?? null,
    }
  } catch {
    return null
  }
}

export default async function AccountBillingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const subscription = await prisma.workspaceSubscription.findFirst({
    orderBy: { createdAt: 'desc' },
    where: { userId: session.user.id },
  })
  const paymentMethod = await getPaymentMethod(subscription?.dodoCustomerId ?? null)

  return (
    <AccountBillingClient
      initialSubscription={
        subscription
          ? {
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
              dodoCustomerId: subscription.dodoCustomerId,
              dodoSubscriptionId: subscription.dodoSubscriptionId,
              id: subscription.id,
              interval: subscription.interval as 'monthly' | 'annual' | 'lifetime',
              seatCount: subscription.seatCount,
              status: subscription.status,
              workspaceId: subscription.workspaceId,
            }
          : null
      }
      paymentMethod={paymentMethod}
    />
  )
}
