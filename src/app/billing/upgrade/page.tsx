'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Check,
  X,
  Zap,
  Users,
  Infinity,
  ArrowRight,
  AlertCircle,
  Shield,
  RefreshCw,
  Lock,

} from 'lucide-react'
import type { PlanKey } from '@/lib/plans'

type BillingInterval = 'monthly' | 'yearly'

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

function SeatSelector({
  value,
  min,
  max,
  onChange,
  accent,
}: {
  value: number
  min: number
  max: number | null
  onChange: (v: number) => void
  accent: 'blue' | 'violet' | 'amber' | 'white'
}) {
  const ring =
    accent === 'blue' ? 'focus:ring-blue-500' :
    accent === 'violet' ? 'focus:ring-violet-500' :
    accent === 'white' ? 'focus:ring-white/50' :
    'focus:ring-amber-500'
  const btn =
    accent === 'blue'
      ? 'border-blue-200 text-blue-700 hover:bg-blue-50 active:bg-blue-100'
      : accent === 'violet'
      ? 'border-violet-200 text-violet-700 hover:bg-violet-50 active:bg-violet-100'
      : accent === 'white'
      ? 'border-white/30 text-white hover:bg-white/10 active:bg-white/20'
      : 'border-amber-200 text-amber-700 hover:bg-amber-50 active:bg-amber-100'
  const inputClass =
    accent === 'white'
      ? 'w-14 text-center border border-white/30 bg-white/10 rounded-lg py-1.5 text-sm font-semibold text-white placeholder-white/50 focus:outline-none focus:ring-2'
      : 'w-14 text-center border border-slate-200 rounded-lg py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2'

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-sm transition-colors ${btn}`}
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max ?? 999}
        value={value}
        onChange={(e) => {
          const v = Math.max(min, parseInt(e.target.value, 10) || min)
          onChange(max ? Math.min(max, v) : v)
        }}
        className={`${inputClass} ${ring}`}
      />
      <button
        onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)}
        className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-sm transition-colors ${btn}`}
      >
        +
      </button>
    </div>
  )
}

function UpgradePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  const [interval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [starterSeats, setStarterSeats] = useState(5)
  const [teamSeats, setTeamSeats] = useState(50)
  const [lifetimeSeats, setLifetimeSeats] = useState(5)
  const [loading, setLoading] = useState<PlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const starterKey: PlanKey = interval === 'yearly' ? 'STARTER_YEARLY' : 'STARTER_MONTHLY'

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

  const starterMonthly = interval === 'yearly' ? (3 * starterSeats * 12).toFixed(0) : (3 * starterSeats).toFixed(2)
  const teamMonthly = (2.5 * teamSeats).toFixed(2)
  const lifetimeTotal = (99 * lifetimeSeats).toFixed(0)

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-white to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">

        {/* Alert banners */}
        {reason === 'trial_expired' && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-4 text-sm font-medium mb-10 max-w-lg mx-auto">
            <AlertCircle className="w-5 h-5 shrink-0" />
            Your free trial has ended. Choose a plan to continue.
          </div>
        )}
        {reason === 'payment_required' && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-2xl px-5 py-4 text-sm font-medium mb-10 max-w-lg mx-auto">
            <AlertCircle className="w-5 h-5 shrink-0" />
            Your subscription requires attention. Please update your billing.
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide mb-5">
            <Zap className="w-3.5 h-3.5" />
            Transparent, seat-based pricing
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Choose your plan
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
            No hidden fees. No long-term contracts.<br />Cancel or change plans anytime.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-slate-100 rounded-full p-1 mt-8 gap-1">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                interval === 'monthly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                interval === 'yearly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Yearly
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-8 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-3.5 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 items-stretch">

          {/* Starter */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Starter</p>
                <p className="text-sm text-slate-500">For small teams</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-extrabold text-slate-900 tracking-tight">$3</span>
                <div className="text-sm text-slate-400 leading-tight">
                  <span>/seat/mo</span>
                  {interval === 'yearly' && <div className="text-emerald-600 font-semibold">billed yearly</div>}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 mb-6">
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Seats {interval === 'monthly' ? '(max 49)' : '(max 49)'}
              </p>
              <SeatSelector value={starterSeats} min={1} max={49} onChange={setStarterSeats} accent="blue" />
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-lg font-bold text-slate-900">
                  ${starterMonthly}
                  <span className="text-sm font-medium text-slate-400">
                    {interval === 'yearly' ? '/year' : '/month'}
                  </span>
                </p>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {['All core modules', 'Project & task management', 'Client portal', 'AI assistant', 'Up to 49 seats'].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} />
                  </div>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout(starterKey, starterSeats)}
              disabled={loading === starterKey}
              className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading === starterKey ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Get Started <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          {/* Team — Featured */}
          <div className="relative bg-gradient-to-b from-blue-600 to-blue-700 rounded-3xl shadow-2xl shadow-blue-200 p-8 flex flex-col text-white scale-[1.02]">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                ✦ Most Popular
              </span>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Team</p>
                <p className="text-sm text-blue-100">For growing agencies</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-extrabold tracking-tight">$2.5</span>
                <div className="text-sm text-blue-200 leading-tight">
                  <span>/seat/mo</span>
                  <div className="text-blue-100">volume discount</div>
                </div>
              </div>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 mb-6 backdrop-blur-sm">
              <p className="text-xs font-semibold text-blue-200 mb-2">Seats (min 50)</p>
              <SeatSelector value={teamSeats} min={50} max={null} onChange={setTeamSeats} accent="white" />
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-xs text-blue-200">Total</p>
                <p className="text-lg font-bold">
                  ${teamMonthly}
                  <span className="text-sm font-medium text-blue-200">/month</span>
                </p>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {['Everything in Starter', '50+ seats included', 'Volume discount', 'Dedicated onboarding', 'SLA support'].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-blue-50">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('TEAM_MONTHLY', teamSeats)}
              disabled={loading === 'TEAM_MONTHLY'}
              className="w-full py-3.5 rounded-2xl bg-white text-blue-700 font-bold text-sm hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
              {loading === 'TEAM_MONTHLY' ? (
                <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin" />
              ) : (
                <>Get Started <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          {/* Lifetime */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <Infinity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Lifetime</p>
                <p className="text-sm text-slate-500">Pay once, use forever</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-extrabold text-slate-900 tracking-tight">$99</span>
                <div className="text-sm text-slate-400 leading-tight">
                  <span>/seat</span>
                  <div className="text-violet-600 font-semibold">one-time</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 mb-6">
              <p className="text-xs font-semibold text-slate-500 mb-2">Seats</p>
              <SeatSelector value={lifetimeSeats} min={1} max={null} onChange={setLifetimeSeats} accent="amber" />
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500">Total (one-time)</p>
                <p className="text-lg font-bold text-slate-900">
                  ${lifetimeTotal}
                  <span className="text-sm font-medium text-slate-400"> forever</span>
                </p>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {['Everything forever', 'No recurring fees', 'All future updates', 'Lifetime support', 'Priority feature requests'].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <div className="w-5 h-5 rounded-full bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-violet-600" strokeWidth={3} />
                  </div>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('LIFETIME', lifetimeSeats)}
              disabled={loading === 'LIFETIME'}
              className="w-full py-3.5 rounded-2xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading === 'LIFETIME' ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Get Lifetime Access <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>

        {/* Feature comparison */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Full feature comparison</h2>
          <p className="text-slate-500 text-center text-sm mb-8">Every plan includes all core modules.</p>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-8 py-5 font-semibold text-slate-700 w-1/2">Feature</th>
                    <th className="text-center px-6 py-5 w-[16.6%]">
                      <div className="flex flex-col items-center gap-1">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-slate-700">Starter</span>
                      </div>
                    </th>
                    <th className="text-center px-6 py-5 w-[16.6%] bg-blue-600/5">
                      <div className="flex flex-col items-center gap-1">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-blue-700">Team</span>
                        <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">Popular</span>
                      </div>
                    </th>
                    <th className="text-center px-6 py-5 w-[16.6%]">
                      <div className="flex flex-col items-center gap-1">
                        <Infinity className="w-4 h-4 text-violet-500" />
                        <span className="font-semibold text-slate-700">Lifetime</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_COMPARISON.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-blue-50/30 transition-colors`}
                    >
                      <td className="px-8 py-4 text-slate-700 font-medium">{row.feature}</td>
                      <td className="px-6 py-4 text-center">
                        {row.starter ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                            <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                            <X className="w-3.5 h-3.5 text-slate-300" strokeWidth={3} />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center bg-blue-600/5">
                        {row.team ? (
                          <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                            <Check className="w-3.5 h-3.5 text-blue-600" strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                            <X className="w-3.5 h-3.5 text-slate-300" strokeWidth={3} />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {row.lifetime ? (
                          <div className="w-6 h-6 rounded-full bg-violet-50 flex items-center justify-center mx-auto">
                            <Check className="w-3.5 h-3.5 text-violet-600" strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                            <X className="w-3.5 h-3.5 text-slate-300" strokeWidth={3} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Trust footer */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 py-6 border-t border-slate-100">
          <div className="flex items-center gap-2.5 text-slate-500 text-sm">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <Shield className="w-4 h-4 text-slate-500" />
            </div>
            Secure checkout
          </div>
          <div className="flex items-center gap-2.5 text-slate-500 text-sm">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </div>
            30-day money-back guarantee
          </div>
          <div className="flex items-center gap-2.5 text-slate-500 text-sm">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <Lock className="w-4 h-4 text-slate-500" />
            </div>
            Cancel anytime, no lock-in
          </div>
        </div>
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
