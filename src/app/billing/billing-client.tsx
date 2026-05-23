'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CreditCard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PauseCircle,
  ArrowUpRight,
  ExternalLink,
  Users,
  Calendar,
  Activity,
  Receipt,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'

type BillingInfo = {
  subscriptionStatus: string
  trialEndsAt: string | null
  trialDaysRemaining: number | null
  planType: string
  seatCount: number
  billingInterval: string | null
  currentPeriodEnd: string | null
  hasBillingAccount: boolean
}

type SubscriptionEvent = {
  id: string
  event: string
  payload: Record<string, unknown> | null
  createdAt: string
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode; message: string }
> = {
  TRIAL: {
    label: 'Free trial',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Clock className="h-4 w-4" />,
    message: 'Explore every core module before choosing a paid plan.',
  },
  ACTIVE: {
    label: 'Active',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: <CheckCircle2 className="h-4 w-4" />,
    message: 'Your workspace is active and billing normally.',
  },
  PAST_DUE: {
    label: 'Past due',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: <AlertTriangle className="h-4 w-4" />,
    message: 'Update your payment method to avoid service interruption.',
  },
  CANCELED: {
    label: 'Canceled',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: <XCircle className="h-4 w-4" />,
    message: 'Your subscription is no longer renewing.',
  },
  PAUSED: {
    label: 'Paused',
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    icon: <PauseCircle className="h-4 w-4" />,
    message: 'Your subscription is paused.',
  },
}

const PLAN_DISPLAY: Record<string, string> = {
  FREE_TRIAL: 'Free Trial',
  STARTER: 'Starter',
  TEAM: 'Team',
  LIFETIME: 'Lifetime',
}

const INTERVAL_DISPLAY: Record<string, string> = {
  MONTHLY: 'Monthly billing',
  YEARLY: 'Annual billing',
  LIFETIME: 'One-time payment',
}

const EVENT_LABELS: Record<string, string> = {
  trial_started: 'Trial started',
  subscription_created: 'Subscription activated',
  invoice_payment_succeeded: 'Payment succeeded',
  invoice_payment_failed: 'Payment failed',
  subscription_canceled: 'Subscription canceled',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getPlanCost(billing: BillingInfo) {
  if (billing.subscriptionStatus === 'TRIAL') {
    return { value: '$0', detail: 'Free during trial' }
  }

  if (billing.billingInterval === 'LIFETIME' || billing.planType === 'LIFETIME') {
    return { value: 'Paid once', detail: 'No recurring charge' }
  }

  const monthlyRate = billing.planType === 'TEAM' ? 2.5 : 3
  const monthlyTotal = billing.seatCount * monthlyRate

  if (billing.billingInterval === 'YEARLY') {
    return {
      value: `$${(monthlyTotal * 10).toFixed(0)}`,
      detail: 'per year, 2 months included',
    }
  }

  if (billing.subscriptionStatus === 'ACTIVE') {
    return {
      value: `$${monthlyTotal.toFixed(2)}`,
      detail: 'per month',
    }
  }

  return { value: '-', detail: 'No active invoice' }
}

function getRenewalLabel(billing: BillingInfo) {
  if (billing.subscriptionStatus === 'TRIAL') return 'Trial ends'
  if (billing.billingInterval === 'LIFETIME' || billing.planType === 'LIFETIME') return 'Renewal'
  return 'Next billing date'
}

function getRenewalValue(billing: BillingInfo) {
  if (billing.subscriptionStatus === 'TRIAL' && billing.trialEndsAt) return formatDate(billing.trialEndsAt)
  if (billing.billingInterval === 'LIFETIME' || billing.planType === 'LIFETIME') return 'Not required'
  if (billing.currentPeriodEnd) return formatDate(billing.currentPeriodEnd)
  return '-'
}

export default function BillingDashboardClient({
  billing,
  events,
}: {
  billing: BillingInfo
  events: SubscriptionEvent[]
}) {
  const router = useRouter()
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  const statusCfg = STATUS_CONFIG[billing.subscriptionStatus] ?? STATUS_CONFIG.TRIAL
  const planName = PLAN_DISPLAY[billing.planType] ?? billing.planType
  const intervalName = billing.billingInterval
    ? INTERVAL_DISPLAY[billing.billingInterval] ?? billing.billingInterval
    : 'No payment method'
  const planCost = getPlanCost(billing)

  async function openPortal() {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res = await fetch('/api/billing/portal')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to open billing portal.')
      if (data.url) router.push(data.url)
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-7 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
              <CreditCard className="h-3.5 w-3.5 text-blue-600" />
              Billing workspace
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Billing & Subscription</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review your current plan, seat count, billing cadence, and recent payment activity.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/billing/upgrade"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <ArrowUpRight className="h-4 w-4" />
              Upgrade plan
            </Link>

            {billing.hasBillingAccount && (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {portalLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Manage billing
              </button>
            )}
          </div>
        </div>

        <section className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-6 sm:p-7">
              <div
                className={`mb-5 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}
              >
                {statusCfg.icon}
                {statusCfg.label}
              </div>

              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Current plan</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{planName}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{statusCfg.message}</p>
                </div>

                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:min-w-[420px]">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      <Users className="h-4 w-4" />
                      Seats
                    </div>
                    <p className="text-2xl font-bold text-slate-950">{billing.seatCount}</p>
                    <p className="mt-1 text-xs text-slate-500">Licensed workspace seats</p>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      <Receipt className="h-4 w-4" />
                      Plan cost
                    </div>
                    <p className="text-2xl font-bold text-slate-950">{planCost.value}</p>
                    <p className="mt-1 text-xs text-slate-500">{planCost.detail}</p>
                  </div>
                </div>
              </div>

              {billing.subscriptionStatus === 'TRIAL' && billing.trialEndsAt && (
                <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  {(billing.trialDaysRemaining ?? 0) > 0 ? (
                    <>
                      <strong>{billing.trialDaysRemaining} day{billing.trialDaysRemaining !== 1 ? 's' : ''}</strong>{' '}
                      remaining. Your trial ends on {formatDate(billing.trialEndsAt)}.
                    </>
                  ) : (
                    'Your free trial has ended. Choose a plan to keep using the workspace.'
                  )}
                </div>
              )}

              {billing.subscriptionStatus === 'PAST_DUE' && (
                <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                  Your last payment failed. Open the billing portal to update your payment method.
                </div>
              )}

              {portalError && <p className="mt-4 text-sm font-medium text-red-600">{portalError}</p>}
            </div>

            <aside className="border-t border-slate-200 bg-slate-50 p-6 sm:p-7 lg:border-l lg:border-t-0">
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <CreditCard className="h-4 w-4" />
                    Billing cadence
                  </div>
                  <p className="text-base font-semibold text-slate-950">{intervalName}</p>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <Calendar className="h-4 w-4" />
                    {getRenewalLabel(billing)}
                  </div>
                  <p className="text-base font-semibold text-slate-950">{getRenewalValue(billing)}</p>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Account status
                  </div>
                  <p className="text-sm leading-6 text-slate-600">
                    Your subscription settings are tied to this workspace and seat count.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Billing history</h2>
            </div>
            <p className="text-xs font-medium text-slate-500">{events.length} recent event{events.length === 1 ? '' : 's'}</p>
          </div>

          {events.length === 0 ? (
            <div className="grid min-h-[180px] place-items-center px-6 py-10 text-center">
              <div>
                <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-md bg-slate-100 text-slate-500">
                  <Receipt className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">No billing events yet</p>
                <p className="mt-1 text-sm text-slate-500">Invoices and subscription updates will appear here.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {events.map((event) => (
                <li key={event.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{EVENT_LABELS[event.event] ?? event.event}</p>
                    {event.payload && Object.keys(event.payload).length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        {Object.entries(event.payload)
                          .slice(0, 2)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(' | ')}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-slate-500">{formatDate(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
