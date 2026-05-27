'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Activity, Truck, AlertTriangle, Building2, TrendingUp, Clock, Radio, Users, Siren, Map, Gauge, ShieldAlert, Bell } from 'lucide-react'

type DashboardMetrics = {
  activeIncidents: number
  todayIncidents: number
  unitsAvailable: number
  unitsInService: number
  hospitalsOnDivert: number
  totalHospitals: number
}

type ActiveIncident = {
  id: string
  incidentNumber: string
  severity: string
  status: string
  chiefComplaint?: string
  address?: string
  patientCount: number
  createdAt: string
  assignedUnit?: { unitNumber: string }
  hospital?: { name: string }
}

type FleetUnit = {
  id: string
  unitNumber: string
  type: string
  status: string
  lat?: number
  lng?: number
  crewMembers: Array<{ crew: { name: string }; role: string }>
}

const severityConfig: Record<string, { label: string; color: string; pulse: boolean }> = {
  ALPHA: { label: 'Alpha', color: '#22c55e', pulse: false },
  BRAVO: { label: 'Bravo', color: '#eab308', pulse: false },
  CHARLIE: { label: 'Charlie', color: '#f97316', pulse: false },
  DELTA: { label: 'Delta', color: '#ef4444', pulse: true },
  ECHO: { label: 'Echo', color: '#dc2626', pulse: true },
  OMEGA: { label: 'OMEGA', color: '#7c3aed', pulse: true },
}

const statusColors: Record<string, string> = {
  AVAILABLE: '#22c55e', DISPATCHED: '#3b82f6', EN_ROUTE: '#f97316',
  ON_SCENE: '#ef4444', TRANSPORTING: '#eab308', AT_HOSPITAL: '#8b5cf6',
  MAINTENANCE: '#6b7280', OFFLINE: '#374151',
}

export default function EmsCommandCenterDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeIncidents: 0, todayIncidents: 0, unitsAvailable: 0,
    unitsInService: 0, hospitalsOnDivert: 0, totalHospitals: 0,
  })
  const [incidents, setIncidents] = useState<ActiveIncident[]>([])
  const [fleet, setFleet] = useState<FleetUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, incidentsRes, fleetRes] = await Promise.all([
        fetch('/api/ems/metrics', { credentials: 'same-origin' }),
        fetch('/api/ems/incidents?active=true', { credentials: 'same-origin' }),
        fetch('/api/ems/fleet', { credentials: 'same-origin' }),
      ])
      const metricsData = await metricsRes.json()
      const incidentsData = await incidentsRes.json()
      const fleetData = await fleetRes.json()

      if (metricsRes.ok) setMetrics(metricsData.data || metricsData)
      if (incidentsRes.ok) setIncidents(Array.isArray(incidentsData) ? incidentsData : incidentsData.data || [])
      if (fleetRes.ok) setFleet(Array.isArray(fleetData) ? fleetData : fleetData.data || [])
    } catch (err) {
      setError('Failed to load command center data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 15000); return () => clearInterval(interval) }, [fetchData])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d18' }}>
        <div style={{ color: '#60a5fa', fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 20, height: 20, border: '2px solid #60a5fa', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Initializing Command Center...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const onlineUnits = fleet.filter((u) => !['OFFLINE', 'MAINTENANCE'].includes(u.status))
  const activeUnits = fleet.filter((u) => ['DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING'].includes(u.status))

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Siren size={20} color="#dc2626" />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
              Command Center
            </h1>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 16 }}>
            <span>{time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              All Systems Nominal
            </span>
          </div>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>{error}</div>}
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Active Incidents', value: metrics.activeIncidents, icon: AlertTriangle, color: '#ef4444', sub: `${metrics.todayIncidents} today` },
          { label: 'Units Available', value: metrics.unitsAvailable, icon: Truck, color: '#22c55e', sub: `${onlineUnits.length} online` },
          { label: 'Units in Field', value: activeUnits.length, icon: Radio, color: '#f97316', sub: `${fleet.length - activeUnits.length - metrics.unitsAvailable} reserve` },
          { label: 'Hospitals Online', value: metrics.totalHospitals - metrics.hospitalsOnDivert, icon: Building2, color: '#3b82f6', sub: `${metrics.hospitalsOnDivert} on divert` },
          { label: 'Response Readiness', value: fleet.length > 0 ? Math.round((metrics.unitsAvailable / fleet.length) * 100) : 0, icon: Gauge, color: '#8b5cf6', suffix: '%', sub: `${fleet.length} total units` },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
                <Icon size={16} color={kpi.color} style={{ opacity: 0.7 }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                {kpi.value}{kpi.suffix || ''}
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{kpi.sub}</div>
            </div>
          )
        })}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Active Incidents */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} color="#ef4444" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Active Incidents</span>
            </div>
            <span style={{ fontSize: 11, color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>
              {incidents.length} pending
            </span>
          </div>
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {incidents.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                <ShieldAlert size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div>No active incidents</div>
              </div>
            ) : (
              incidents.map((inc) => {
                const sev = severityConfig[inc.severity] || severityConfig.ALPHA
                return (
                  <div key={inc.id} style={{
                    padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: sev.color, boxShadow: sev.pulse ? `0 0 8px ${sev.color}` : 'none',
                      animation: sev.pulse ? 'pulse 2s infinite' : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', display: 'flex', gap: 8, alignItems: 'center' }}>
                        {inc.incidentNumber}
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 3,
                          background: sev.color + '20', color: sev.color, fontWeight: 600,
                        }}>{sev.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                        {inc.chiefComplaint || 'No complaint'} {inc.assignedUnit && <span>· {inc.assignedUnit.unitNumber}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', textAlign: 'right', flexShrink: 0 }}>
                      <div>{inc.patientCount} patient{inc.patientCount !== 1 ? 's' : ''}</div>
                      <div style={{ fontSize: 10 }}>{new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Fleet Status & Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Fleet Status */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Truck size={14} color="#3b82f6" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Fleet Status</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { status: 'Available', count: metrics.unitsAvailable, color: '#22c55e' },
                  { status: 'In Field', count: activeUnits.length, color: '#f97316' },
                  { status: 'Maintenance', count: fleet.filter((u) => u.status === 'MAINTENANCE').length, color: '#6b7280' },
                  { status: 'Offline', count: fleet.filter((u) => u.status === 'OFFLINE').length, color: '#374151' },
                ].map((s) => (
                  <div key={s.status} style={{ flex: 1, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.count}</div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.status}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 180, overflow: 'auto', padding: '0 18px' }}>
              {fleet.slice(0, 5).map((unit) => (
                <div key={unit.id} style={{
                  padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[unit.status] || '#6b7280', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', flex: 1 }}>{unit.unitNumber}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{unit.type.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 11, color: statusColors[unit.status] || '#6b7280' }}>{unit.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <Activity size={16} color="#8b5cf6" style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{metrics.todayIncidents}</div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Today's Incidents</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <TrendingUp size={16} color="#22c55e" style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{fleet.length > 0 ? Math.round((onlineUnits.length / fleet.length) * 100) : 0}%</div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Fleet Availability</div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights Bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(124,58,237,0.08) 100%)',
        border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, padding: '12px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Radio size={14} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#93c5fd' }}>AI Operations Summary</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
            {metrics.activeIncidents > 0
              ? `${metrics.activeIncidents} active incidents — ${metrics.unitsAvailable} units available for dispatch. ${metrics.hospitalsOnDivert > 0 ? `${metrics.hospitalsOnDivert} hospital(s) on divert.` : 'All hospitals accepting patients.'}`
              : 'No active incidents. All units standing by.'}
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>AI · Live</div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
        ::-webkit-scrollbar { width: 4px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px }
      `}</style>
    </div>
  )
}
