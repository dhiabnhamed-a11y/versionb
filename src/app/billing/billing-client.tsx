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
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  TRIAL: {
    label: 'Free Trial',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    icon: <Clock className="w-4 h-4" />,
  },
  ACTIVE: {
    label: 'Active',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  PAST_DUE: {
    label: 'Past Due',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  CANCELED: {
    label: 'Canceled',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    icon: <XCircle className="w-4 h-4" />,
  },
  PAUSED: {
    label: 'Paused',
    color: 'text-slate-700',
    bg: 'bg-slate-50 border-slate-200',
    icon: <PauseCircle className="w-4 h-4" />,
  },
}

const PLAN_DISPLAY: Record<string, string> = {
  FREE_TRIAL: 'Free Trial',
  STARTER: 'Starter',
  TEAM: 'Team',
  LIFETIME: 'Lifetime',
}

const INTERVAL_DISPLAY: Record<string, string> = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime',
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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            Billing & Subscription
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage your plan, seats, and payment details.</p>
        </div>

        {/* Status card */}
        <div className={`rounded-2xl border p-6 mb-6 ${statusCfg.bg}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className={`inline-flex items-center gap-1.5 font-semibold text-sm ${statusCfg.color} mb-2`}>
                {statusCfg.icon}
                {statusCfg.label}
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {PLAN_DISPLAY[billing.planType] ?? billing.planType}
                {billing.billingInterval && (
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    ({INTERVAL_DISPLAY[billing.billingInterval] ?? billing.billingInterval})
                  </span>
                )}
              </h2>

              {billing.subscriptionStatus === 'TRIAL' && billing.trialEndsAt && (
                <p className="text-sm mt-1 text-blue-700">
                  {(billing.trialDaysRemaining ?? 0) > 0 ? (
                    <>
                      <strong>{billing.trialDaysRemaining} day{billing.trialDaysRemaining !== 1 ? 's' : ''}</strong> remaining in your free trial
                      — expires {formatDate(billing.trialEndsAt)}
                    </>
                  ) : (
                    'Your free trial has ended.'
                  )}
                </p>
              )}

              {billing.subscriptionStatus === 'ACTIVE' && billing.currentPeriodEnd && (
                <p className="text-sm mt-1 text-slate-600">
                  Next billing date: <strong>{formatDate(billing.currentPeriodEnd)}</strong>
                </p>
              )}

              {billing.subscriptionStatus === 'PAST_DUE' && (
                <p className="text-sm mt-1 text-amber-700 font-medium">
                  Your last payment failed. Update your payment method to restore access.
                </p>
              )}
            </div>

            <div className="flex gap-3 flex-wrap">
              <Link
                href="/billing/upgrade"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                <ArrowUpRight className="w-4 h-4" />
                Upgrade Plan
              </Link>

              {billing.hasBillingAccount && (
                <button
                  onClick={openPortal}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-60"
                >
                  {portalLoading ? (
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Manage Billing
                </button>
              )}
            </div>
          </div>
          {portalError && <p className="text-sm text-red-600 mt-3">{portalError}</p>}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <Users className="w-4 h-4" /> Seats
            </div>
            <p className="text-2xl font-bold text-slate-900">{billing.seatCount}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <CreditCard className="w-4 h-4" /> Monthly cost
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {billing.subscriptionStatus === 'ACTIVE' && billing.billingInterval !== 'LIFETIME'
                ? `$${(billing.seatCount * 3).toFixed(0)}`
                : billing.subscriptionStatus === 'TRIAL'
                ? 'Free trial'
                : billing.billingInterval === 'LIFETIME'
                ? 'One-time'
                : '—'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <Calendar className="w-4 h-4" />{' '}
              {billing.subscriptionStatus === 'TRIAL' ? 'Trial ends' : 'Period ends'}
            </div>
            <p className="text-base font-semibold text-slate-900">
              {billing.subscriptionStatus === 'TRIAL' && billing.trialEndsAt
                ? formatDate(billing.trialEndsAt)
                : billing.currentPeriodEnd
                ? formatDate(billing.currentPeriodEnd)
                : '—'}
            </p>
          </div>
        </div>

        {/* Subscription event log */}
        <div className="bg-white rounded-2xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Billing history</h2>
          </div>
          {events.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">No billing events yet.</div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {events.map((event) => (
                <li key={event.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {EVENT_LABELS[event.event] ?? event.event}
                    </p>
                    {event.payload && Object.keys(event.payload).length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {Object.entries(event.payload)
                          .slice(0, 2)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
