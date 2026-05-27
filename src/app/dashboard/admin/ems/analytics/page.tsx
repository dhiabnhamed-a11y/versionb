'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { BarChart3, TrendingUp, Activity, Clock, AlertTriangle, Zap, Truck } from 'lucide-react'
import { useLocale } from '@/components/i18n/LocaleProvider'

type AnalyticsData = {
  activeIncidents: number
  todayIncidents: number
  unitsAvailable: number
  avgResponseTime?: number
  byDay?: Record<string, number>
  bySeverity?: Record<string, number>
  total?: number
}

export default function AnalyticsPage() {
  const { t } = useLocale()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/ems/analytics?section=overview', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/ems/analytics?section=timeline&days=14', { credentials: 'same-origin' }).then((r) => r.json()),
    ]).then(([overview, timeline]) => {
      setData({ ...(overview?.data || overview), ...(timeline?.data || timeline) })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: '#64748b', fontSize: 13 }}>{t('common.loading')}</div>

  const byDay = data?.byDay || {}
  const bySeverity = data?.bySeverity || {}
  const severityColors: Record<string, string> = { ALPHA: '#22c55e', BRAVO: '#eab308', CHARLIE: '#f97316', DELTA: '#ef4444', ECHO: '#dc2626', OMEGA: '#7c3aed' }
  const days = Object.keys(byDay).sort()
  const maxDayCount = Math.max(...Object.values(byDay), 1)
  const severityTotal = Object.values(bySeverity).reduce((s, v) => s + v, 0)

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={18} color="#22c55e" /> {t('ems.analytics.title')}
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{t('ems.dispatch.subtitle')}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { labelKey: 'ems.command.activeIncidents', value: data?.activeIncidents ?? 0, icon: AlertTriangle, color: '#ef4444' },
          { labelKey: 'ems.command.todayIncidents', value: data?.todayIncidents ?? 0, icon: Activity, color: '#f97316' },
          { labelKey: 'ems.command.unitsAvailable', value: data?.unitsAvailable ?? 0, icon: Truck, color: '#22c55e' },
          { labelKey: 'ems.command.responseReadiness', value: data?.avgResponseTime ? `${Math.round(data.avgResponseTime / 60)}m` : '—', icon: Clock, color: '#60a5fa' },
          { labelKey: 'ems.command.todayIncidents', value: data?.total ?? 0, icon: TrendingUp, color: '#8b5cf6' },
          { labelKey: 'ems.command.severityDistribution', value: severityTotal, icon: Zap, color: '#f59e0b' },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.labelKey} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t(kpi.labelKey as any)}</span>
                <Icon size={14} color={kpi.color} style={{ opacity: 0.7 }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{kpi.value}</div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 18 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={14} color="#60a5fa" /> {t('ems.command.severityDistribution')}
          </h3>
          {days.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 13 }}>{t('common.noData')}</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, paddingTop: 10 }}>
              {days.map((day) => {
                const count = byDay[day] || 0
                const pct = (count / maxDayCount) * 100
                const label = day.slice(5)
                return (
                  <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 10, color: '#64748b' }}>{count}</span>
                    <div style={{ width: '100%', height: `${Math.max(pct, 2)}%`, background: 'linear-gradient(180deg, #3b82f6, #60a5fa)', borderRadius: '2px 2px 0 0', minHeight: 4, transition: 'height 0.5s ease' }} />
                    <span style={{ fontSize: 8, color: '#475569', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 18 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} color="#f59e0b" /> {t('ems.command.severityDistribution')}
          </h3>
          {Object.keys(bySeverity).length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 13 }}>{t('common.noData')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(bySeverity).sort(([, a], [, b]) => b - a).map(([sev, count]) => {
                const pct = (count / severityTotal) * 100
                return (
                  <div key={sev}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <span style={{ color: severityColors[sev] || '#94a3b8', fontWeight: 600 }}>{sev}</span>
                      <span style={{ color: '#64748b' }}>{count} ({Math.round(pct)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: severityColors[sev] || '#6b7280', borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


