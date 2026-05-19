'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Zap, Users, Crown, Infinity, ArrowRight, AlertCircle } from 'lucide-react'
import type { PlanKey } from '@/lib/plans'

type BillingStatus = {
  subscriptionStatus: string
  trialDaysRemaining: number | null
  planType: string
  seatCount: number
}

const PLAN_CARDS: {
  key: PlanKey
  icon: React.ReactNode
  badge?: string
  badgeColor?: string
  features: string[]
}[] = [
  {
    key: 'STARTER_MONTHLY',
    icon: <Zap className="w-5 h-5" />,
    features: ['All core modules', 'Project & task management', 'Client portal', 'AI assistant', 'Up to 49 seats'],
  },
  {
    key: 'STARTER_YEARLY',
    icon: <Zap className="w-5 h-5" />,
    badge: 'Save 2 months',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    features: ['Everything in Starter', 'Billed annually', 'Priority support', 'Up to 49 seats'],
  },
  {
    key: 'TEAM_MONTHLY',
    icon: <Users className="w-5 h-5" />,
    badge: 'Volume pricing',
    badgeColor: 'bg-blue-100 text-blue-700',
    features: ['Everything in Starter', '50+ seats', 'Volume discount', 'Dedicated onboarding', 'SLA support'],
  },
  {
    key: 'LIFETIME',
    icon: <Infinity className="w-5 h-5" />,
    badge: 'One-time',
    badgeColor: 'bg-purple-100 text-purple-700',
    features: ['Everything forever', 'No recurring fees', 'All future updates', 'Lifetime support'],
  },
]

const PLAN_META: Record<
  PlanKey,
  { name: string; pricePerSeat: number; interval: string; minSeats: number; maxSeats: number | null }
> = {
  STARTER_MONTHLY: { name: 'Starter', pricePerSeat: 3, interval: '/seat/mo', minSeats: 1, maxSeats: 49 },
  STARTER_YEARLY: { name: 'Starter Annual', pricePerSeat: 3, interval: '/seat/mo billed yearly', minSeats: 1, maxSeats: 49 },
  TEAM_MONTHLY: { name: 'Team', pricePerSeat: 2.5, interval: '/seat/mo', minSeats: 50, maxSeats: null },
  LIFETIME: { name: 'Lifetime', pricePerSeat: 99, interval: '/seat one-time', minSeats: 1, maxSeats: null },
}

const FEATURE_COMPARISON = [
  { feature: 'Project & task management', starter: true, team: true, lifetime: true },
  { feature: 'Client portal', starter: true, team: true, lifetime: true },
  { feature: 'AI assistant & automation', starter: true, team: true, lifetime: true },
  { feature: 'Finance & payroll modules', starter: true, team: true, lifetime: true },
  { feature: 'Enterprise operations', starter: true, team: true, lifetime: true },
  { feature: 'Social media manager', starter: true, team: true, lifetime: true },
  { feature: 'Contract management', starter: true, team: true, lifetime: true },
  { feature: 'Volume discount (50+ seats)', starter: false, team: true, lifetime: true },
  { feature: 'Dedicated onboarding', starter: false, team: true, lifetime: true },
  { feature: 'SLA support', starter: false, team: true, lifetime: true },
  { feature: 'All future updates', starter: false, team: false, lifetime: true },
]

function UpgradePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  const [seats, setSeats] = useState<Record<PlanKey, number>>({
    STARTER_MONTHLY: 5,
    STARTER_YEARLY: 5,
    TEAM_MONTHLY: 50,
    LIFETIME: 5,
  })
  const [loading, setLoading] = useState<PlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout(planKey: PlanKey) {
    setLoading(planKey)
    setError(null)
    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey, seats: seats[planKey] }),
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

  function calcTotal(planKey: PlanKey) {
    const meta = PLAN_META[planKey]
    const s = seats[planKey]
    if (planKey === 'STARTER_YEARLY') return `$${(meta.pricePerSeat * s * 12).toFixed(0)}/year`
    if (planKey === 'LIFETIME') return `$${(meta.pricePerSeat * s).toFixed(0)} one-time`
    return `$${(meta.pricePerSeat * s).toFixed(2)}/month`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          {reason === 'trial_expired' && (
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-4 py-2 text-sm font-medium mb-6">
              <AlertCircle className="w-4 h-4" />
              Your free trial has ended. Choose a plan to continue.
            </div>
          )}
          {reason === 'payment_required' && (
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-full px-4 py-2 text-sm font-medium mb-6">
              <AlertCircle className="w-4 h-4" />
              Your subscription requires attention. Please update your billing.
            </div>
          )}
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Choose your plan</h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Simple per-seat pricing. No hidden fees. Cancel anytime.
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-16">
          {PLAN_CARDS.map((card) => {
            const meta = PLAN_META[card.key]
            const seatVal = seats[card.key]
            const isLoading = loading === card.key

            return (
              <div
                key={card.key}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      {card.icon}
                    </div>
                    <span className="font-semibold text-slate-800">{meta.name}</span>
                  </div>
                  {card.badge && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900">${meta.pricePerSeat}</span>
                    <span className="text-sm text-slate-400">{meta.interval}</span>
                  </div>
                </div>

                {/* Seat selector */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Seats {meta.minSeats > 1 ? `(min ${meta.minSeats})` : ''}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setSeats((s) => ({
                          ...s,
                          [card.key]: Math.max(meta.minSeats, (s[card.key] ?? meta.minSeats) - 1),
                        }))
                      }
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 text-sm font-bold"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={meta.minSeats}
                      max={meta.maxSeats ?? 999}
                      value={seatVal}
                      onChange={(e) => {
                        const v = Math.max(meta.minSeats, parseInt(e.target.value, 10) || meta.minSeats)
                        const capped = meta.maxSeats ? Math.min(v, meta.maxSeats) : v
                        setSeats((s) => ({ ...s, [card.key]: capped }))
                      }}
                      className="w-14 text-center border border-slate-200 rounded-lg py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() =>
                        setSeats((s) => ({
                          ...s,
                          [card.key]: meta.maxSeats
                            ? Math.min(meta.maxSeats, (s[card.key] ?? meta.minSeats) + 1)
                            : (s[card.key] ?? meta.minSeats) + 1,
                        }))
                      }
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-blue-600 font-semibold mt-1.5">Total: {calcTotal(card.key)}</p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {card.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(card.key)}
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Get Started <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Feature comparison table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Feature comparison
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Feature</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500">Starter</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500">Team</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500">Lifetime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {FEATURE_COMPARISON.map((row) => (
                  <tr key={row.feature} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 text-slate-700">{row.feature}</td>
                    <td className="px-4 py-3 text-center">
                      {row.starter ? (
                        <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.team ? (
                        <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.lifetime ? (
                        <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
          Secure checkout powered by Stripe. All plans include a 30-day money-back guarantee.
        </p>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradePageInner />
    </Suspense>
  )
}
