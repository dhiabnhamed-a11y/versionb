'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Truck, AlertTriangle, Building2, TrendingUp, Clock, Radio,
  Users, Gauge, ShieldAlert, Bell, Satellite, Zap, Crosshair, RefreshCw,
} from 'lucide-react'
import { useLocale } from '@/components/i18n/LocaleProvider'
import { EMS_SEVERITY_COLORS } from '@/lib/ems-config'

interface DashboardMetrics {
  activeIncidents: number
  todayIncidents: number
  unitsAvailable: number
  unitsInService: number
  hospitalsOnDivert: number
  totalHospitals: number
  hospitalsOnline: number
}

interface Incident {
  id: string
  incidentNumber: string
  severity: string
  status: string
  chiefComplaint: string | null
  address: string | null
  patientCount: number
  createdAt: string
  assignedUnit: { unitNumber: string } | null
}

interface FleetUnit {
  id: string
  unitNumber: string
  type: string
  status: string
  lat: number | null
  lng: number | null
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status}`)
  const json = await res.json()
  return (json?.data ?? json) as T
}

export default function EmsCommandCenterDashboard() {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [time, setTime] = useState(new Date())
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [fleet, setFleet] = useState<FleetUnit[]>([])

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [metricsData, incidentsData, fleetData] = await Promise.all([
        fetchJson<DashboardMetrics>('/api/ems/metrics'),
        fetchJson<Incident[]>('/api/ems/incidents?active=true'),
        fetchJson<{ units: FleetUnit[]; summary: any }>('/api/ems/fleet'),
      ])
      setMetrics(metricsData)
      setFleet(fleetData.units ?? [])
      setIncidents(Array.isArray(incidentsData) ? incidentsData : [])
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15_000)
    const clock = setInterval(() => setTime(new Date()), 1000)
    return () => { clearInterval(interval); clearInterval(clock) }
  }, [loadData])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d18' }}>
        <div style={{ textAlign: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            style={{ width: 32, height: 32, border: '2px solid rgba(96,165,250,0.2)', borderTop: '2px solid #60a5fa', borderRadius: '50%', margin: '0 auto 12px' }}
          />
          <div style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600 }}>{t('ems.command.initializing')}</div>
          <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>{t('ems.command.loadingTelemetry')}</div>
        </div>
      </div>
    )
  }

  const activeIncidents = metrics?.activeIncidents ?? 0
  const todayIncidents = metrics?.todayIncidents ?? 0
  const unitsAvailable = metrics?.unitsAvailable ?? 0
  const totalHospitals = metrics?.totalHospitals ?? 0
  const hospitalsOnDivert = metrics?.hospitalsOnDivert ?? 0
  const unitsInService = metrics?.unitsInService ?? 0

  const onlineUnits = fleet.filter((u) => u.status !== 'OFFLINE' && u.status !== 'MAINTENANCE')
  const activeUnits = fleet.filter((u) => ['DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING'].includes(u.status))
  const readinessPct = fleet.length > 0 ? Math.round((unitsAvailable / fleet.length) * 100) : 0

  const kpiItems = [
    { key: 'ems.command.activeIncidents', value: activeIncidents, icon: AlertTriangle, color: '#ef4444', sub: `${todayIncidents} ${t('ems.command.todayIncidents')}` },
    { key: 'ems.command.unitsAvailable', value: unitsAvailable, icon: Truck, color: '#22c55e', sub: `${onlineUnits.length} ${t('common.online')}` },
    { key: 'ems.command.unitsInField', value: unitsInService, icon: Radio, color: '#f97316', sub: `${activeUnits.length} active` },
    { key: 'ems.command.hospitalsOnline', value: totalHospitals - hospitalsOnDivert, icon: Building2, color: '#3b82f6', sub: `${hospitalsOnDivert} on divert` },
    { key: 'ems.command.responseReadiness', value: readinessPct, icon: Gauge, color: readinessPct > 60 ? '#22c55e' : readinessPct > 30 ? '#eab308' : '#ef4444', suffix: '%', sub: `${fleet.length} total units` },
  ]

  const statusItems = [
    { key: 'status.available', count: unitsAvailable, color: '#22c55e' },
    { key: 'ems.command.unitsInField', count: activeUnits.length, color: '#f97316' },
    { key: 'status.maintenance', count: fleet.filter((u) => u.status === 'MAINTENANCE').length, color: '#6b7280' },
    { key: 'status.offline', count: fleet.filter((u) => u.status === 'OFFLINE').length, color: '#374151' },
  ]

  const severityDist = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'OMEGA'].map((sev) => ({
    sev,
    count: incidents.filter((i) => i.severity === sev).length,
  }))
  const maxSevCount = Math.max(...severityDist.map((s) => s.count), 1)

  const statusColors: Record<string, string> = {
    AVAILABLE: '#22c55e', DISPATCHED: '#3b82f6', EN_ROUTE: '#f97316',
    ON_SCENE: '#ef4444', TRANSPORTING: '#eab308', MAINTENANCE: '#6b7280', OFFLINE: '#374151',
  }

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
        ::-webkit-scrollbar { width: 4px; height: 4px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #dc2626, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Satellite size={17} color="#fff" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
              {t('ems.command.title')}
            </h1>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#60a5fa', fontWeight: 600 }}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            {error ? (
              <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={11} /> {error}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                Live · refreshed {lastRefresh ? lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={loadData}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {kpiItems.map((kpi) => {
          const Icon = kpi.icon
          return (
            <motion.div
              key={kpi.key}
              whileHover={{ y: -2 }}
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(kpi.key as any)}</div>
                <Icon size={15} color={kpi.color} style={{ opacity: 0.7 }} />
              </div>
              <motion.div
                key={kpi.value}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}
              >
                {kpi.value}{kpi.suffix || ''}
              </motion.div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{kpi.sub}</div>
            </motion.div>
          )
        })}
      </div>

      {/* Three-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr', gap: 14, marginBottom: 20 }}>
        {/* Active Incidents */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} color="#ef4444" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{t('ems.command.activeIncidents')}</span>
            </div>
            <span style={{ fontSize: 10, color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 3 }}>
              {incidents.length} total
            </span>
          </div>
          <div style={{ maxHeight: 340, overflow: 'auto' }}>
            {incidents.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#475569' }}>
                No active incidents
              </div>
            ) : incidents.map((inc) => {
              const color = EMS_SEVERITY_COLORS[inc.severity] || '#6b7280'
              const isHigh = ['ECHO', 'DELTA', 'OMEGA'].includes(inc.severity)
              return (
                <div key={inc.id} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <motion.div
                    animate={isHigh ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: isHigh ? `0 0 8px ${color}` : 'none' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', display: 'flex', gap: 6, alignItems: 'center' }}>
                      {inc.incidentNumber}
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: color + '20', color, fontWeight: 600 }}>{inc.severity}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{inc.chiefComplaint || 'Emergency'}</div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
                      {inc.address || 'Location pending'} · {inc.patientCount} patient{inc.patientCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', textAlign: 'right', flexShrink: 0 }}>
                    {inc.assignedUnit && <div style={{ color: '#60a5fa' }}>{inc.assignedUnit.unitNumber}</div>}
                    <div>{new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Fleet */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Truck size={13} color="#3b82f6" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{t('ems.command.fleetStatus')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {statusItems.map((s) => (
                  <div key={s.key} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, textAlign: 'center' }}>
                    <motion.div key={s.count} initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ fontSize: 18, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>
                      {s.count}
                    </motion.div>
                    <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t(s.key as any)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 140, overflow: 'auto', padding: '0 16px' }}>
              {fleet.slice(0, 8).map((unit) => {
                const color = statusColors[unit.status] || '#6b7280'
                return (
                  <div key={unit.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', flex: 1 }}>{unit.unitNumber}</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>{unit.type}</span>
                    <span style={{ fontSize: 10, color }}>{unit.status.replace(/_/g, ' ')}</span>
                  </div>
                )
              })}
              {fleet.length === 0 && (
                <div style={{ padding: '12px 0', fontSize: 11, color: '#475569', textAlign: 'center' }}>No units registered</div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <Activity size={14} color="#8b5cf6" style={{ marginBottom: 3 }} />
              <motion.div key={todayIncidents} initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
                {todayIncidents}
              </motion.div>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>{t('ems.command.todayIncidents')}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <TrendingUp size={14} color="#22c55e" style={{ marginBottom: 3 }} />
              <motion.div key={readinessPct} initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
                {readinessPct}%
              </motion.div>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>{t('ems.command.fleetAvailability')}</div>
            </div>
          </div>
        </div>

        {/* Severity Heatmap + System Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={11} color="#f59e0b" /> {t('ems.command.severityDistribution')}
            </div>
            {severityDist.map(({ sev, count }) => {
              const color = EMS_SEVERITY_COLORS[sev] || '#6b7280'
              const pct = (count / maxSevCount) * 100
              return (
                <div key={sev} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                    <span style={{ color, fontWeight: 600 }}>{sev}</span>
                    <span style={{ color: '#64748b' }}>{count}</span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(count > 0 ? pct : 0, 0)}%` }}
                      transition={{ duration: 0.6 }}
                      style={{ height: '100%', background: color, borderRadius: 2 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, flex: 1 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Activity size={11} color="#22c55e" /> System Status
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Dispatch Queue', value: `${incidents.filter(i => i.status === 'PENDING').length} pending`, color: '#f97316' },
                { label: 'Units Responding', value: String(unitsInService), color: '#3b82f6' },
                { label: 'Hospitals Online', value: `${totalHospitals - hospitalsOnDivert} / ${totalHospitals}`, color: '#22c55e' },
                { label: 'On Divert', value: String(hospitalsOnDivert), color: hospitalsOnDivert > 0 ? '#ef4444' : '#22c55e' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{item.label}</span>
                  <span style={{ fontSize: 10, color: item.color, fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights Bar */}
      <motion.div
        whileHover={{ borderColor: 'rgba(59,130,246,0.3)' }}
        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(124,58,237,0.08) 100%)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #3b82f6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Radio size={14} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('ems.command.aiSummary')}
            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontSize: 9, color: '#22c55e', fontWeight: 400 }}>● Live</motion.span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
            {activeIncidents > 0
              ? `${activeIncidents} active incident${activeIncidents !== 1 ? 's' : ''} — ${unitsAvailable} unit${unitsAvailable !== 1 ? 's' : ''} available for dispatch.${hospitalsOnDivert > 0 ? ` ${hospitalsOnDivert} hospital${hospitalsOnDivert !== 1 ? 's' : ''} on divert.` : ' All hospitals accepting patients.'}`
              : 'No active incidents. All units standing by.'}
          </div>
        </div>
        <div style={{ fontSize: 9, color: '#475569', flexShrink: 0 }}>
          Auto-refresh 15s
        </div>
      </motion.div>
    </div>
  )
}
