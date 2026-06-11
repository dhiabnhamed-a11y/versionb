import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, type ApiParams } from '@/lib/api'
import { getCurrentWorkspaceSubscription } from '@/lib/billing-subscriptions'
import { listDodoPayments, toDodoErrorMessage } from '@/lib/dodo'
import { formatUsd } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      const subscription = await getCurrentWorkspaceSubscription(user.id)
      if (!subscription?.dodoCustomerId) return apiData({ invoices: [] })

      try {
        const payments = await listDodoPayments(subscription.dodoCustomerId, 12)
        return apiData({
          invoices: payments.slice(0, 12).map((payment) => ({
            amount: formatUsd(payment.total_amount / 100),
            date: payment.created_at,
            description: payment.subscription_id ? 'TASKIT subscription' : 'TASKIT one-time payment',
            id: payment.payment_id,
            invoiceUrl: payment.invoice_url ?? null,
            status: payment.status ?? 'processing',
          })),
        })
      } catch (error) {
        return apiData({ error: toDodoErrorMessage(error) }, { status: 502 }) as never
      }
    },
    { auth: 'required', route: '/api/billing/invoices' }
  )
}
