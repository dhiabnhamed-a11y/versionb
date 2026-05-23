'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  Check,
  Infinity,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  Shield,
  Users,
  X,
  Zap,
} from 'lucide-react'
import type { PlanKey } from '@/lib/plans'

type BillingInterval = 'monthly' | 'yearly'
type Accent = 'blue' | 'emerald' | 'violet'

const FEATURE_COMPARISON = [
  { feature: 'Project & task management', starter: true, team: true, lifetime: true },
  { feature: 'Client portal', starter: true, team: true, lifetime: true },
  { feature: 'AI assistant & automation', starter: true, team: true, lifetime: true },
  { feature: 'Finance & payroll modules', starter: true, team: true, lifetime: true },
  { feature: 'Enterprise operations', starter: true, team: true, lifetime: true },
  { feature: 'Social media manager', starter: true, team: true, lifetime: true },
  { feature: 'Contract management', starter: true, team: true, lifetime: true },
  { feature: 'Volume discount at 50+ seats', starter: false, team: true, lifetime: true },
  { feature: 'Dedicated onboarding', starter: false, team: true, lifetime: true },
  { feature: 'SLA support', starter: false, team: true, lifetime: true },
  { feature: 'All future updates', starter: false, team: false, lifetime: true },
]

const PLAN_FEATURES = {
  starter: ['All core modules', 'Project and task management', 'Client portal', 'AI assistant', 'Up to 49 seats'],
  team: ['Everything in Starter', '50+ seats included', 'Volume discount', 'Dedicated onboarding', 'SLA support'],
  lifetime: ['Everything in Team', 'No recurring fees', 'All future updates', 'Lifetime support', 'Priority feature requests'],
}

function money(value: number, decimals = 2) {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

function SeatSelector({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number | null
  onChange: (value: number) => void
}) {
  function setSeatCount(next: number) {
    const clampedMin = Math.max(min, next)
    onChange(max ? Math.min(max, clampedMin) : clampedMin)
  }

  return (
    <div className="flex h-10 w-full max-w-[164px] items-center overflow-hidden rounded-md border border-slate-300 bg-white">
      <button
        type="button"
        aria-label="Decrease seats"
        onClick={() => setSeatCount(value - 1)}
        className="grid h-10 w-10 shrink-0 place-items-center text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={value <= min}
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        min={min}
        max={max ?? 999}
        value={value}
        onChange={(event) => setSeatCount(parseInt(event.target.value, 10) || min)}
        className="h-10 min-w-0 flex-1 border-x border-slate-200 bg-white px-2 text-center text-sm font-bold text-slate-950 outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        aria-label="Increase seats"
        onClick={() => setSeatCount(value + 1)}
        className="grid h-10 w-10 shrink-0 place-items-center text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={max ? value >= max : false}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

function PlanFeature({ children, accent }: { children: React.ReactNode; accent: Accent }) {
  const color =
    accent === 'blue' ? 'text-blue-600 bg-blue-50' : accent === 'emerald' ? 'text-emerald-600 bg-emerald-50' : 'text-violet-600 bg-violet-50'

  return (
    <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ${color}`}>
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      {children}
    </li>
  )
}

function LoadingDot() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
}

function ComparisonMark({ value, accent }: { value: boolean; accent: Accent }) {
  if (!value) {
    return (
      <span className="mx-auto grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-300">
        <X className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    )
  }

  const color =
    accent === 'blue' ? 'bg-blue-50 text-blue-600' : accent === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'

  return (
    <span className={`mx-auto grid h-6 w-6 place-items-center rounded-md ${color}`}>
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  )
}

function UpgradePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()
  const reason = searchParams.get('reason')
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [starterSeats, setStarterSeats] = useState(5)
  const [teamSeats, setTeamSeats] = useState(50)
  const [lifetimeSeats, setLifetimeSeats] = useState(5)
  const [loading, setLoading] = useState<PlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') return null
  if (status === 'unauthenticated') {
    signIn(undefined, { callbackUrl: '/billing/upgrade' })
    return null
  }

  const starterKey: PlanKey = interval === 'yearly' ? 'STARTER_YEARLY' : 'STARTER_MONTHLY'
  const starterSeatRate = interval === 'yearly' ? 30 : 3
  const starterTotal = starterSeatRate * starterSeats
  const teamTotal = 2.5 * teamSeats
  const lifetimeTotal = 99 * lifetimeSeats

  async function handleCheckout(planKey: PlanKey, seatCount: number) {
    setLoading(planKey)
    setError(null)
    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey, seats: seatCount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start checkout.')
      if (data.url) router.push(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {reason === 'trial_expired' && (
          <div className="mb-6 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Your free trial has ended. Choose a plan to continue.
          </div>
        )}
        {reason === 'payment_required' && (
          <div className="mb-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Your subscription requires attention. Please update your billing.
          </div>
        )}

        <section className="mb-8 border-b border-slate-200 pb-7">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                <Calculator className="h-3.5 w-3.5 text-blue-600" />
                Transparent seat-based pricing
              </div>
              <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Choose the plan that matches your team size.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Every plan includes Taskit core modules. Pricing changes only by seat count, billing cadence, and support level.
              </p>
            </div>

            <div className="w-full lg:w-auto">
              <div className="inline-grid w-full grid-cols-2 rounded-md border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
                <button
                  type="button"
                  onClick={() => setBillingInterval('monthly')}
                  className={`min-h-10 rounded-md px-5 text-sm font-semibold transition ${
                    interval === 'monthly' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval('yearly')}
                  className={`min-h-10 rounded-md px-5 text-sm font-semibold transition ${
                    interval === 'yearly' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Yearly - save 17%
                </button>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <section className="mb-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <article className="flex min-h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-600">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">1-49 seats</span>
              </div>
              <h2 className="text-xl font-bold text-slate-950">Starter</h2>
              <p className="mt-1 text-sm text-slate-600">Best for small teams getting organized.</p>
            </div>

            <div className="flex flex-1 flex-col p-6">
              <div>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight text-slate-950">
                    {interval === 'yearly' ? '$30' : '$3'}
                  </span>
                  <span className="pb-1 text-sm font-medium text-slate-500">
                    {interval === 'yearly' ? '/seat/year' : '/seat/month'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {interval === 'yearly' ? 'Equivalent to $2.50 per seat/month, billed yearly.' : 'Billed monthly. Upgrade or cancel anytime.'}
                </p>
              </div>

              <div className="my-6 border-y border-slate-200 py-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Seats</p>
                    <p className="text-xs text-slate-500">Maximum 49 seats</p>
                  </div>
                  <SeatSelector value={starterSeats} min={1} max={49} onChange={setStarterSeats} />
                </div>
                <div className="rounded-md bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Estimated total</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {money(starterTotal, interval === 'yearly' ? 0 : 2)}
                    <span className="text-sm font-medium text-slate-500">{interval === 'yearly' ? '/year' : '/month'}</span>
                  </p>
                </div>
              </div>

              <ul className="mb-6 flex-1 space-y-3">
                {PLAN_FEATURES.starter.map((feature) => (
                  <PlanFeature key={feature} accent="blue">
                    {feature}
                  </PlanFeature>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handleCheckout(starterKey, starterSeats)}
                disabled={loading === starterKey}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading === starterKey ? <LoadingDot /> : <>Get started <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          </article>

          <article className="relative flex min-h-full flex-col rounded-lg border-2 border-emerald-500 bg-white shadow-[0_20px_50px_rgba(15,118,110,0.12)]">
            <div className="absolute right-4 top-4 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
              Most popular
            </div>
            <div className="border-b border-slate-200 p-6 pr-32">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-600">
                <Users className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-950">Team</h2>
              <p className="mt-1 text-sm text-slate-600">Best for growing agencies and larger departments.</p>
            </div>

            <div className="flex flex-1 flex-col p-6">
              <div>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight text-slate-950">$2.50</span>
                  <span className="pb-1 text-sm font-medium text-slate-500">/seat/month</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">Volume pricing starts at 50 seats and includes onboarding.</p>
              </div>

              <div className="my-6 border-y border-slate-200 py-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Seats</p>
                    <p className="text-xs text-slate-500">Minimum 50 seats</p>
                  </div>
                  <SeatSelector value={teamSeats} min={50} max={null} onChange={setTeamSeats} />
                </div>
                <div className="rounded-md bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Estimated total</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {money(teamTotal)}
                    <span className="text-sm font-medium text-slate-500">/month</span>
                  </p>
                </div>
              </div>

              <ul className="mb-6 flex-1 space-y-3">
                {PLAN_FEATURES.team.map((feature) => (
                  <PlanFeature key={feature} accent="emerald">
                    {feature}
                  </PlanFeature>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handleCheckout('TEAM_MONTHLY', teamSeats)}
                disabled={loading === 'TEAM_MONTHLY'}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading === 'TEAM_MONTHLY' ? <LoadingDot /> : <>Get started <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          </article>

          <article className="flex min-h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-violet-50 text-violet-600">
                  <Infinity className="h-5 w-5" />
                </div>
                <span className="rounded-md bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">One-time</span>
              </div>
              <h2 className="text-xl font-bold text-slate-950">Lifetime</h2>
              <p className="mt-1 text-sm text-slate-600">Best for teams that prefer one payment.</p>
            </div>

            <div className="flex flex-1 flex-col p-6">
              <div>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight text-slate-950">$99</span>
                  <span className="pb-1 text-sm font-medium text-slate-500">/seat</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">Pay once per seat. No recurring subscription.</p>
              </div>

              <div className="my-6 border-y border-slate-200 py-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Seats</p>
                    <p className="text-xs text-slate-500">Add as many as needed</p>
                  </div>
                  <SeatSelector value={lifetimeSeats} min={1} max={null} onChange={setLifetimeSeats} />
                </div>
                <div className="rounded-md bg-violet-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-violet-700">One-time total</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {money(lifetimeTotal, 0)}
                    <span className="text-sm font-medium text-slate-500"> forever</span>
                  </p>
                </div>
              </div>

              <ul className="mb-6 flex-1 space-y-3">
                {PLAN_FEATURES.lifetime.map((feature) => (
                  <PlanFeature key={feature} accent="violet">
                    {feature}
                  </PlanFeature>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handleCheckout('LIFETIME', lifetimeSeats)}
                disabled={loading === 'LIFETIME'}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading === 'LIFETIME' ? <LoadingDot /> : <>Get lifetime access <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          </article>
        </section>

        <section className="mb-8 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-950">Full feature comparison</h2>
            <p className="mt-1 text-sm text-slate-600">Every plan includes the core workspace. Higher tiers add buying terms and support.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-1/2 px-6 py-4 text-left font-semibold text-slate-700">Feature</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-600" />
                      Starter
                    </span>
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-emerald-700">
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-600" />
                      Team
                    </span>
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <Infinity className="h-4 w-4 text-violet-600" />
                      Lifetime
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {FEATURE_COMPARISON.map((row) => (
                  <tr key={row.feature} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{row.feature}</td>
                    <td className="px-6 py-4 text-center">
                      <ComparisonMark value={row.starter} accent="blue" />
                    </td>
                    <td className="px-6 py-4 text-center bg-emerald-50/40">
                      <ComparisonMark value={row.team} accent="emerald" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <ComparisonMark value={row.lifetime} accent="violet" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-3">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
              <Shield className="h-4 w-4" />
            </span>
            Secure checkout
          </div>
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
              <RefreshCw className="h-4 w-4" />
            </span>
            30-day money-back guarantee
          </div>
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
              <Lock className="h-4 w-4" />
            </span>
            Cancel anytime
          </div>
        </section>
      </div>
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
