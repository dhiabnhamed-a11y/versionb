'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Clock, CheckCircle2, AlertTriangle, XCircle, Users, TrendingUp, AlertCircle } from 'lucide-react'

type BillingStats = {
  total: number
  trial: number
  trialExpiringThisWeek: number
  active: number
  pastDue: number
  canceled: number
  totalActiveSeats: number
  mrrEstimate: number
}

const STAT_CARDS: {
  key: keyof BillingStats
  label: string
  icon: React.ReactNode
  color: string
  bg: string
}[] = [
  { key: 'trial', label: 'On Trial', icon: <Clock className="w-5 h-5" />, color: 'text-blue-700', bg: 'bg-blue-50' },
  { key: 'trialExpiringThisWeek', label: 'Trial Expiring (7d)', icon: <AlertTriangle className="w-5 h-5" />, color: 'text-amber-700', bg: 'bg-amber-50' },
  { key: 'active', label: 'Active Subscriptions', icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  { key: 'pastDue', label: 'Past Due', icon: <AlertCircle className="w-5 h-5" />, color: 'text-orange-700', bg: 'bg-orange-50' },
  { key: 'canceled', label: 'Canceled', icon: <XCircle className="w-5 h-5" />, color: 'text-red-700', bg: 'bg-red-50' },
  { key: 'totalActiveSeats', label: 'Active Seats', icon: <Users className="w-5 h-5" />, color: 'text-violet-700', bg: 'bg-violet-50' },
]

export default function SuperAdminBillingOverview() {
  const [stats, setStats] = useState<BillingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/super-admin/billing-overview', { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load billing overview.')
        setStats(data as BillingStats)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Billing Overview</h2>
        <p className="text-sm text-slate-500">Aggregate subscription and revenue metrics across all companies.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <>
          {/* MRR highlight */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-300 text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                Estimated MRR
              </div>
              <div className="text-4xl font-bold">${stats.mrrEstimate.toLocaleString()}</div>
              <div className="text-slate-400 text-xs mt-1">Based on active seats × $3/seat</div>
            </div>
            <div className="text-right">
              <div className="text-slate-300 text-sm mb-1">Total companies</div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {STAT_CARDS.map((card) => (
              <div key={card.key} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className={`inline-flex items-center gap-1.5 text-xs font-medium mb-3 px-2 py-1 rounded-full ${card.bg} ${card.color}`}>
                  {card.icon}
                  {card.label}
                </div>
                <div className="text-3xl font-bold text-slate-900">{(stats[card.key] as number).toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Conversion rate */}
          {stats.trial + stats.active > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-sm font-medium text-slate-600 mb-3">Trial → Paid conversion rate</div>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${stats.trial + stats.active > 0 ? Math.round((stats.active / (stats.trial + stats.active)) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-slate-900 whitespace-nowrap">
                  {stats.trial + stats.active > 0
                    ? Math.round((stats.active / (stats.trial + stats.active)) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                <span><strong className="text-slate-700">{stats.active}</strong> paid</span>
                <span><strong className="text-slate-700">{stats.trial}</strong> still trialing</span>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
