'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { PlanKey } from '@/lib/plans'

type BillingInterval = 'monthly' | 'yearly'
type Accent = 'blue' | 'emerald' | 'violet'
type PricingPlanId = 'starter' | 'team' | 'lifetime'

type PricingPlan = {
  id: PricingPlanId
  accent: Accent
  badge: string
  cta: string
  description: string
  features: string[]
  maxSeats: number | null
  minSeats: number
  name: string
  planKey: (interval: BillingInterval) => PlanKey
  priceContext: (interval: BillingInterval) => string
  priceLabel: (interval: BillingInterval) => string
  priceValue: (interval: BillingInterval) => number
  totalLabel: (interval: BillingInterval) => string
  valueProp: string
}

const PLANS: PricingPlan[] = [
  {
    id: 'starter',
    accent: 'blue',
    badge: 'For focused teams',
    cta: 'Start with Starter',
    description: 'Core TASKIT workflows for teams that need a clear operating rhythm.',
    features: ['AI Assistant', 'Client Portal', 'Project Management', 'Operations Workspace', 'Real-time alerts'],
    maxSeats: 49,
    minSeats: 1,
    name: 'Starter',
    planKey: (interval) => (interval === 'yearly' ? 'STARTER_YEARLY' : 'STARTER_MONTHLY'),
    priceContext: (interval) => (interval === 'yearly' ? 'per seat/year' : 'per seat/month'),
    priceLabel: (interval) => (interval === 'yearly' ? '$30' : '$3'),
    priceValue: (interval) => (interval === 'yearly' ? 30 : 3),
    totalLabel: (interval) => (interval === 'yearly' ? 'Estimated Yearly Total' : 'Estimated Monthly Total'),
    valueProp: 'Launch a reliable workspace for day-to-day execution.',
  },
  {
    id: 'team',
    accent: 'emerald',
    badge: 'Most Popular',
    cta: 'Choose Team',
    description: 'Advanced operating controls, onboarding, and volume pricing for growing teams.',
    features: ['Everything in Starter', 'AI Workflow Automation', 'Advanced Client Portal', 'Role Permissions', 'Priority Support'],
    maxSeats: null,
    minSeats: 50,
    name: 'Team',
    planKey: () => 'TEAM_MONTHLY',
    priceContext: () => 'per seat/month',
    priceLabel: () => '$2.50',
    priceValue: () => 2.5,
    totalLabel: () => 'Estimated Monthly Total',
    valueProp: 'Scale departments and client work with premium support.',
  },
  {
    id: 'lifetime',
    accent: 'violet',
    badge: 'One-time',
    cta: 'Get lifetime access',
    description: 'A one-time purchase for teams that want long-term TASKIT access.',
    features: ['Everything in Team', 'No Recurring Fees', 'All Future Updates', 'Lifetime Support', 'Priority Feature Requests'],
    maxSeats: null,
    minSeats: 1,
    name: 'Lifetime',
    planKey: () => 'LIFETIME',
    priceContext: () => 'per seat',
    priceLabel: () => '$99',
    priceValue: () => 99,
    totalLabel: () => 'One-time Total',
    valueProp: 'Own your workspace access with no recurring subscription.',
  },
]

const COMPARISON_GROUPS = [
  {
    group: 'Workspace essentials',
    rows: [
      { feature: 'AI Assistant', starter: true, team: true, lifetime: true },
      { feature: 'Client Portal', starter: true, team: true, lifetime: true },
      { feature: 'Project Management', starter: true, team: true, lifetime: true },
      { feature: 'Operations Workspace', starter: true, team: true, lifetime: true },
    ],
  },
  {
    group: 'Scale and control',
    rows: [
      { feature: 'Custom roles and permissions', starter: false, team: true, lifetime: true },
      { feature: 'Advanced billing and invoicing', starter: true, team: true, lifetime: true },
      { feature: 'Volume pricing at 50+ seats', starter: false, team: true, lifetime: true },
      { feature: 'Dedicated onboarding', starter: false, team: true, lifetime: true },
    ],
  },
  {
    group: 'Support and terms',
    rows: [
      { feature: 'Priority support', starter: false, team: true, lifetime: true },
      { feature: 'SLA support', starter: false, team: true, lifetime: true },
      { feature: 'No recurring subscription', starter: false, team: false, lifetime: true },
      { feature: 'All future updates', starter: false, team: false, lifetime: true },
    ],
  },
]

const TRUST_SIGNALS: Array<[string, LucideIcon]> = [
  ['SOC-ready controls', ShieldCheck],
  ['Fast secure checkout', Zap],
  ['Change plans anytime', ChevronRight],
]

function money(value: number, decimals = Number.isInteger(value) ? 0 : 2) {
  return `$${value.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })}`
}

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return response.json()
  const text = await response.text().catch(() => '')
  throw new Error(text.includes('<!DOCTYPE') ? 'Checkout API returned a page instead of JSON. Please refresh and try again.' : text || 'Checkout failed.')
}

function accentClasses(accent: Accent) {
  if (accent === 'emerald') {
    return {
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
      button:
        'bg-emerald-600 text-white shadow-[0_14px_32px_rgba(5,150,105,0.28)] hover:bg-emerald-500 hover:shadow-[0_18px_38px_rgba(5,150,105,0.34)]',
      check: 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/15',
      panel: 'bg-emerald-50/80 text-emerald-950 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-400/15',
    }
  }
  if (accent === 'violet') {
    return {
      badge: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200',
      button:
        'bg-[linear-gradient(135deg,#7c3aed,#a855f7_45%,#2563eb)] text-white shadow-[0_14px_32px_rgba(124,58,237,0.28)] hover:shadow-[0_18px_38px_rgba(124,58,237,0.36)]',
      check: 'bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-400/10 dark:text-violet-200 dark:ring-violet-400/15',
      panel: 'bg-violet-50/80 text-violet-950 ring-violet-100 dark:bg-violet-400/10 dark:text-violet-100 dark:ring-violet-400/15',
    }
  }
  return {
    badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200',
    button:
      'border border-slate-300 bg-white text-slate-950 shadow-sm hover:border-slate-400 hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15',
    check: 'bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-400/15',
    panel: 'bg-blue-50/80 text-blue-950 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-100 dark:ring-blue-400/15',
  }
}

function LoadingDot() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
}

function SeatSelector({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string
  max: number | null
  min: number
  onChange: (value: number) => void
  value: number
}) {
  function setSeatCount(next: number) {
    const nextValue = Math.max(min, Math.floor(next || min))
    onChange(max ? Math.min(max, nextValue) : nextValue)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <label className="text-[15px] font-semibold text-slate-900 dark:text-white" htmlFor={`${label}-seats`}>
          Seats
        </label>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {max ? `${min}-${max} seats` : min > 1 ? `${min}+ seats` : 'Any team size'}
        </span>
      </div>
      <div className="flex h-[52px] items-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-250 focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-950/5 dark:border-white/10 dark:bg-white/5 dark:focus-within:border-white/30 dark:focus-within:ring-white/10">
        <button
          type="button"
          aria-label={`Decrease ${label} seats`}
          onClick={() => setSeatCount(value - 1)}
          disabled={value <= min}
          className="grid h-full w-14 shrink-0 place-items-center text-slate-500 transition duration-250 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <input
          id={`${label}-seats`}
          aria-label={`${label} seat count`}
          type="number"
          min={min}
          max={max ?? 999}
          value={value}
          onChange={(event) => setSeatCount(Number(event.target.value))}
          className="h-full min-w-0 flex-1 border-x border-slate-200 bg-transparent text-center text-lg font-bold text-slate-950 outline-none transition duration-250 dark:border-white/10 dark:text-white"
        />
        <button
          type="button"
          aria-label={`Increase ${label} seats`}
          onClick={() => setSeatCount(value + 1)}
          disabled={max ? value >= max : false}
          className="grid h-full w-14 shrink-0 place-items-center text-slate-500 transition duration-250 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function FeatureItem({ accent, feature }: { accent: Accent; feature: string }) {
  const classes = accentClasses(accent)
  return (
    <li className="flex items-start gap-3 text-[15px] leading-6 text-slate-700 dark:text-slate-300">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 ${classes.check}`}>
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
      <span>{feature}</span>
    </li>
  )
}

function PricingCard({
  interval,
  loading,
  onCheckout,
  onSeatsChange,
  plan,
  seats,
}: {
  interval: BillingInterval
  loading: boolean
  onCheckout: (plan: PricingPlan, seats: number) => void
  onSeatsChange: (planId: PricingPlanId, seats: number) => void
  plan: PricingPlan
  seats: number
}) {
  const classes = accentClasses(plan.accent)
  const total = plan.priceValue(interval) * seats
  const isTeam = plan.id === 'team'
  const isLifetime = plan.id === 'lifetime'

  return (
    <article
      className={`group relative flex min-h-full flex-col rounded-[24px] border bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur transition duration-250 hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.13)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:bg-slate-950/82 ${
        isTeam
          ? 'border-emerald-300 shadow-[0_28px_90px_rgba(5,150,105,0.2)] lg:scale-[1.03] dark:border-emerald-400/35'
          : 'border-slate-200 dark:border-white/10'
      }`}
    >
      {isTeam && (
        <>
          <div className="absolute inset-x-6 top-0 h-1.5 rounded-b-full bg-gradient-to-r from-emerald-300 via-emerald-500 to-teal-400" />
          <div className="absolute -top-4 right-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1.5 text-xs font-bold text-white shadow-[0_14px_32px_rgba(5,150,105,0.32)]">
            Most Popular
          </div>
        </>
      )}

      <div className="flex flex-1 flex-col">
        <div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${classes.badge}`}>
            {plan.badge}
          </span>
          <h2 className="mt-5 text-[28px] font-bold leading-tight text-slate-950 dark:text-white">{plan.name}</h2>
          <p className="mt-3 min-h-12 text-base leading-7 text-slate-600 dark:text-slate-300">{plan.valueProp}</p>
        </div>

        <div className="mt-8">
          <div className="flex items-end gap-3">
            <span className="text-[64px] font-extrabold leading-none tracking-tight text-slate-950 transition duration-250 dark:text-white">
              {plan.priceLabel(interval)}
            </span>
            <span className="pb-2 text-base font-medium text-slate-500 dark:text-slate-400">{plan.priceContext(interval)}</span>
          </div>
          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">{plan.description}</p>
        </div>

        <div className="mt-7 space-y-5 rounded-[20px] border border-slate-200 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <SeatSelector
            label={plan.id}
            max={plan.maxSeats}
            min={plan.minSeats}
            value={seats}
            onChange={(nextSeats) => onSeatsChange(plan.id, nextSeats)}
          />
          <div className={`rounded-2xl p-4 ring-1 transition duration-250 ${classes.panel}`}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-75">{plan.totalLabel(interval)}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">
              {money(total, isLifetime || interval === 'yearly' ? 0 : 2)}
              <span className="text-base font-semibold opacity-70">{isLifetime ? ' one-time' : interval === 'yearly' ? '/year' : '/month'}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onCheckout(plan, seats)}
          disabled={loading}
          className={`mt-6 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-bold transition duration-250 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:opacity-65 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:focus:ring-white/15 ${classes.button}`}
        >
          {loading ? (
            <LoadingDot />
          ) : (
            <>
              {plan.cta}
              <ArrowRight className="h-4 w-4 transition duration-250 group-hover:translate-x-0.5" aria-hidden="true" />
            </>
          )}
        </button>

        <div className="my-7 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/12" />

        <ul className="space-y-4">
          {plan.features.map((feature) => (
            <FeatureItem key={feature} accent={plan.accent} feature={feature} />
          ))}
        </ul>
      </div>
    </article>
  )
}

function ComparisonMark({ accent, value }: { accent: Accent; value: boolean }) {
  if (!value) {
    return <span className="mx-auto block h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" aria-label="Not included" />
  }

  const classes = accentClasses(accent)
  return (
    <span className={`mx-auto grid h-8 w-8 place-items-center rounded-full ring-1 ${classes.check}`} aria-label="Included">
      <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
    </span>
  )
}

function PricingComparison() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6 lg:px-8 lg:pb-[120px]" aria-labelledby="comparison-heading">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Compare plans</p>
          <h2 id="comparison-heading" className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white md:text-4xl">
            Every detail, clearly mapped.
          </h2>
        </div>
        <p className="max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
          A modern comparison matrix for fast buying decisions across workspace, scale, support, and long-term ownership.
        </p>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/78">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.04]">
                <th className="sticky left-0 z-10 w-[38%] bg-slate-50/95 px-6 py-5 text-sm font-bold uppercase tracking-[0.12em] text-slate-500 backdrop-blur dark:bg-slate-950/95 dark:text-slate-400">
                  Feature
                </th>
                {PLANS.map((plan) => (
                  <th key={plan.id} className="px-6 py-5 text-center">
                    <span className="text-base font-bold text-slate-950 dark:text-white">{plan.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARISON_GROUPS.map((group) => (
              <tbody key={group.group} className="divide-y divide-slate-100 dark:divide-white/8">
                <tr>
                  <th
                    colSpan={4}
                    className="bg-slate-100/80 px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"
                  >
                    {group.group}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.feature} className="transition duration-250 hover:bg-slate-50/90 dark:hover:bg-white/[0.04]">
                    <th className="sticky left-0 z-10 bg-white/95 px-6 py-5 text-[15px] font-semibold text-slate-800 backdrop-blur dark:bg-slate-950/95 dark:text-slate-200">
                      {row.feature}
                    </th>
                    <td className="px-6 py-5 text-center">
                      <ComparisonMark accent="blue" value={row.starter} />
                    </td>
                    <td className="bg-emerald-50/35 px-6 py-5 text-center dark:bg-emerald-400/[0.04]">
                      <ComparisonMark accent="emerald" value={row.team} />
                    </td>
                    <td className="px-6 py-5 text-center">
                      <ComparisonMark accent="violet" value={row.lifetime} />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </section>
  )
}

function UpgradePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()
  const reason = searchParams.get('reason')
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [seatsByPlan, setSeatsByPlan] = useState<Record<PricingPlanId, number>>({
    lifetime: 5,
    starter: 5,
    team: 50,
  })
  const [loadingPlan, setLoadingPlan] = useState<PricingPlanId | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      void signIn(undefined, { callbackUrl: '/billing/upgrade' })
    }
  }, [status])

  const planTotals = useMemo(
    () =>
      Object.fromEntries(
        PLANS.map((plan) => [plan.id, plan.priceValue(interval) * seatsByPlan[plan.id]])
      ) as Record<PricingPlanId, number>,
    [interval, seatsByPlan]
  )

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" aria-label="Loading pricing" />
      </main>
    )
  }

  function setPlanSeats(planId: PricingPlanId, seats: number) {
    setSeatsByPlan((current) => ({ ...current, [planId]: seats }))
  }

  async function handleCheckout(plan: PricingPlan, seatCount: number) {
    setLoadingPlan(plan.id)
    setError(null)
    try {
      const response = await fetch('/api/billing/create-checkout-session', {
        body: JSON.stringify({ planKey: plan.planKey(interval), seats: seatCount }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const payload = (await readJsonResponse(response)) as {
        data?: { url?: string; error?: string }
        error?: string
        url?: string
      }
      const data = payload.data ?? payload
      if (!response.ok) throw new Error(data.error ?? 'Failed to start checkout.')
      if (data.url) router.push(data.url)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Something went wrong.')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f9fc] text-slate-950 dark:bg-[#070b12] dark:text-white">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_8%,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_86%_12%,rgba(59,130,246,0.12),transparent_26%),radial-gradient(circle_at_55%_88%,rgba(124,58,237,0.11),transparent_32%)] dark:bg-[radial-gradient(circle_at_12%_8%,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_86%_12%,rgba(59,130,246,0.14),transparent_26%),radial-gradient(circle_at_55%_88%,rgba(124,58,237,0.14),transparent_32%)]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute left-8 top-32 -z-10 h-72 w-72 rounded-full bg-emerald-200/25 blur-3xl dark:bg-emerald-500/10" aria-hidden="true" />
      <div className="pointer-events-none absolute right-8 top-20 -z-10 h-80 w-80 rounded-full bg-blue-200/25 blur-3xl dark:bg-blue-500/10" aria-hidden="true" />

      <section className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 lg:px-8 lg:py-[120px]" aria-labelledby="pricing-heading">
        <div className="mx-auto mb-14 max-w-4xl text-center">
          {reason === 'trial_expired' && (
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              Your free trial has ended. Choose a plan to continue.
            </div>
          )}
          {reason === 'payment_required' && (
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              Your subscription needs attention. Choose or update a plan.
            </div>
          )}

          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/8 dark:text-slate-200">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
            Premium seat-based pricing
          </div>

          <h1 id="pricing-heading" className="text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white md:text-6xl lg:text-7xl">
            Choose the plan that matches your operating scale.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            TASKIT brings AI, client portals, project operations, billing, and workspace execution into one trusted operating layer.
          </p>

          <div className="mt-9 inline-flex rounded-2xl border border-slate-200 bg-white/85 p-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/8">
            {[
              { label: 'Monthly', value: 'monthly' as const },
              { label: 'Yearly - save 17%', value: 'yearly' as const },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={interval === option.value}
                onClick={() => setBillingInterval(option.value)}
                className={`h-11 rounded-xl px-5 text-sm font-bold transition duration-250 focus:outline-none focus:ring-4 focus:ring-slate-950/10 dark:focus:ring-white/15 ${
                  interval === option.value
                    ? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mx-auto mb-8 flex max-w-4xl items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 shadow-sm dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              interval={interval}
              loading={loadingPlan === plan.id}
              onCheckout={handleCheckout}
              onSeatsChange={setPlanSeats}
              plan={plan}
              seats={seatsByPlan[plan.id]}
            />
          ))}
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300 sm:grid-cols-3">
          {TRUST_SIGNALS.map(([label, Icon]) => (
            <div key={String(label)} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/6">
              <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
              {label}
            </div>
          ))}
        </div>

        <div className="sr-only" aria-live="polite">
          Starter total {money(planTotals.starter)}. Team total {money(planTotals.team)}. Lifetime total {money(planTotals.lifetime, 0)}.
        </div>
      </section>

      <PricingComparison />
    </main>
  )
}

export default function UpgradePage() {
  return (
    <Suspense fallback={null}>
      <UpgradePageInner />
    </Suspense>
  )
}
