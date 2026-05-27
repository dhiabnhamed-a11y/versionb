'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Truck, AlertTriangle, Building2, TrendingUp, Clock, Radio,
  Users, Siren, Map, Gauge, ShieldAlert, Bell, Satellite, Zap, Crosshair,
} from 'lucide-react'

const severityColors: Record<string, string> = {
  ALPHA: '#22c55e', BRAVO: '#eab308', CHARLIE: '#f97316',
  DELTA: '#ef4444', ECHO: '#dc2626', OMEGA: '#7c3aed',
}

const telemMessages = [
  'All units reporting for duty',
  'Weather advisory: Clear skies',
  'Traffic alert: I-95 southbound delay',
  'Hospital capacity: 72% average',
  'AED inventory: All units equipped',
  'Radio check: All channels operational',
  'Fuel depot: Resupply completed',
]

export default function EmsCommandCenterDashboard() {
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())
  const [telemIndex, setTelemIndex] = useState(0)
  const [simActive, setSimActive] = useState(false)

  // Simulated metrics that work without API
  const [metrics, setMetrics] = useState({
    activeIncidents: 3,
    todayIncidents: 12,
    unitsAvailable: 8,
    unitsInService: 6,
    hospitalsOnDivert: 2,
    totalHospitals: 6,
  })

  const [incidents] = useState([
    { id: '1', incidentNumber: 'INC-20260527-001', severity: 'ECHO', status: 'ACTIVE', chiefComplaint: 'Cardiac Arrest — 68yo Male', address: '1245 Main St', patientCount: 1, createdAt: new Date(Date.now() - 720000).toISOString(), assignedUnit: { unitNumber: 'EMS-201' } },
    { id: '2', incidentNumber: 'INC-20260527-002', severity: 'DELTA', status: 'ACTIVE', chiefComplaint: 'MVA with Entrapment', address: 'I-95 / Exit 14', patientCount: 3, createdAt: new Date(Date.now() - 1800000).toISOString(), assignedUnit: { unitNumber: 'EMS-145' } },
    { id: '3', incidentNumber: 'INC-20260527-003', severity: 'CHARLIE', status: 'ACTIVE', chiefComplaint: 'Difficulty Breathing', address: '789 Oak Ave', patientCount: 1, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: '4', incidentNumber: 'INC-20260526-012', severity: 'BRAVO', status: 'PENDING', chiefComplaint: 'Fall Injury — Hip Pain', address: '456 Elm St', patientCount: 1, createdAt: new Date(Date.now() - 7200000).toISOString() },
  ])

  const [fleet] = useState([
    { id: 'u1', unitNumber: 'EMS-201', type: 'ALS', status: 'EN_ROUTE', lat: 36.172, lng: -115.142 },
    { id: 'u2', unitNumber: 'EMS-145', type: 'BLS', status: 'ON_SCENE', lat: 36.169, lng: -115.139 },
    { id: 'u3', unitNumber: 'MICU-301', type: 'MICU', status: 'AVAILABLE', lat: 36.175, lng: -115.148 },
    { id: 'u4', unitNumber: 'EMS-332', type: 'ALS', status: 'AVAILABLE', lat: 36.165, lng: -115.135 },
    { id: 'u5', unitNumber: 'EMS-089', type: 'BLS', status: 'TRANSPORTING', lat: 36.178, lng: -115.144 },
    { id: 'u6', unitNumber: 'SUP-001', type: 'SUP', status: 'AVAILABLE', lat: 36.171, lng: -115.150 },
    { id: 'u7', unitNumber: 'EMS-411', type: 'ALS', status: 'MAINTENANCE', lat: 36.174, lng: -115.138 },
    { id: 'u8', unitNumber: 'MICU-202', type: 'MICU', status: 'AVAILABLE', lat: 36.168, lng: -115.141 },
    { id: 'u9', unitNumber: 'EMS-550', type: 'BLS', status: 'OFFLINE', lat: 36.173, lng: -115.147 },
    { id: 'u10', unitNumber: 'EMS-275', type: 'ALS', status: 'AVAILABLE', lat: 36.170, lng: -115.143 },
  ])

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    const telemTimer = setInterval(() => setTelemIndex((i) => (i + 1) % telemMessages.length), 5000)
    return () => { clearInterval(timer); clearInterval(telemTimer) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setSimActive((prev) => !prev)
      setMetrics((prev) => ({
        ...prev,
        activeIncidents: Math.max(1, prev.activeIncidents + (Math.random() > 0.5 ? 1 : -1)),
        unitsAvailable: Math.max(2, Math.min(12, prev.unitsAvailable + (Math.random() > 0.6 ? 1 : -1))),
      }))
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  const onlineUnits = fleet.filter((u) => u.status !== 'OFFLINE' && u.status !== 'MAINTENANCE')
  const activeUnits = fleet.filter((u) => ['DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING'].includes(u.status))
  const readinessPct = fleet.length > 0 ? Math.round((metrics.unitsAvailable / fleet.length) * 100) : 0

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d18' }}>
        <div style={{ textAlign: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            style={{ width: 32, height: 32, border: '2px solid rgba(96,165,250,0.2)', borderTop: '2px solid #60a5fa', borderRadius: '50%', margin: '0 auto 12px' }}
          />
          <div style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600 }}>Initializing Command Center...</div>
          <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>Loading telemetry, fleet, and incident data</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
        ::-webkit-scrollbar { width: 4px; height: 4px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px }
        @keyframes shimmer { to { background-position: -200% 0 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'linear-gradient(135deg, #dc2626, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Satellite size={17} color="#fff" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
              Command Center
            </h1>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#60a5fa', fontWeight: 600 }}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              All Systems Nominal
            </span>
          </div>
        </div>

        {/* Live Telemetry Ticker */}
        <div style={{
          padding: '6px 14px', borderRadius: 6, maxWidth: 280,
          background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 0.6, delay: i * 0.2, repeat: Infinity }}
                style={{ width: 3, height: 3, borderRadius: '50%', background: '#60a5fa' }}
              />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={telemIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: 11, color: '#93c5fd' }}
            >
              {telemMessages[telemIndex]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Active Incidents', value: metrics.activeIncidents, icon: AlertTriangle, color: '#ef4444', sub: `${metrics.todayIncidents} today` },
          { label: 'Units Available', value: metrics.unitsAvailable, icon: Truck, color: '#22c55e', sub: `${onlineUnits.length} online` },
          { label: 'Units in Field', value: activeUnits.length, icon: Radio, color: '#f97316', sub: `${fleet.length - activeUnits.length - metrics.unitsAvailable} reserve` },
          { label: 'Hospitals Online', value: metrics.totalHospitals - metrics.hospitalsOnDivert, icon: Building2, color: '#3b82f6', sub: `${metrics.hospitalsOnDivert} on divert` },
          { label: 'Response Readiness', value: readinessPct, icon: Gauge, color: readinessPct > 60 ? '#22c55e' : readinessPct > 30 ? '#eab308' : '#ef4444', suffix: '%', sub: `${fleet.length} total units` },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <motion.div
              key={kpi.label}
              whileHover={{ y: -2 }}
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
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
              <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>Active Incidents</span>
            </div>
            <span style={{ fontSize: 10, color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 3 }}>
              {incidents.length} total
            </span>
          </div>
          <div style={{ maxHeight: 340, overflow: 'auto' }}>
            {incidents.map((inc) => {
              const color = severityColors[inc.severity] || '#6b7280'
              const isHigh = inc.severity === 'ECHO' || inc.severity === 'DELTA' || inc.severity === 'OMEGA'
              return (
                <div key={inc.id} style={{
                  padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <motion.div
                    animate={isHigh ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0,
                      boxShadow: isHigh ? `0 0 8px ${color}` : 'none' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', display: 'flex', gap: 6, alignItems: 'center' }}>
                      {inc.incidentNumber}
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: color + '20', color, fontWeight: 600 }}>{inc.severity}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{inc.chiefComplaint}</div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{inc.address} · {inc.patientCount} patient{inc.patientCount !== 1 ? 's' : ''}</div>
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

        {/* Fleet + Map Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Truck size={13} color="#3b82f6" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>Fleet Status</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: 'Available', count: metrics.unitsAvailable, color: '#22c55e' },
                  { label: 'In Field', count: activeUnits.length, color: '#f97316' },
                  { label: 'Maintenance', count: fleet.filter((u) => u.status === 'MAINTENANCE').length, color: '#6b7280' },
                  { label: 'Offline', count: fleet.filter((u) => u.status === 'OFFLINE').length, color: '#374151' },
                ].map((s) => (
                  <div key={s.label} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, textAlign: 'center' }}>
                    <motion.div key={s.count} initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ fontSize: 18, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>
                      {s.count}
                    </motion.div>
                    <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 140, overflow: 'auto', padding: '0 16px' }}>
              {fleet.slice(0, 5).map((unit) => {
                const statusColors: Record<string, string> = {
                  AVAILABLE: '#22c55e', DISPATCHED: '#3b82f6', EN_ROUTE: '#f97316',
                  ON_SCENE: '#ef4444', TRANSPORTING: '#eab308', MAINTENANCE: '#6b7280', OFFLINE: '#374151',
                }
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
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <Activity size={14} color="#8b5cf6" style={{ marginBottom: 3 }} />
              <motion.div key={metrics.todayIncidents} initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
                {metrics.todayIncidents}
              </motion.div>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Today's Incidents</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <TrendingUp size={14} color="#22c55e" style={{ marginBottom: 3 }} />
              <motion.div key={readinessPct} initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
                {readinessPct}%
              </motion.div>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Fleet Availability</div>
            </div>
          </div>
        </div>

        {/* Right Column: Severity Heatmap + Live Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={11} color="#f59e0b" /> Severity Distribution
            </div>
            {['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'OMEGA'].map((sev) => {
              const count = incidents.filter((i) => i.severity === sev).length
              const maxCount = Math.max(...incidents.map((i) => incidents.filter((x) => x.severity === i.severity).length), 1)
              const pct = (count / maxCount) * 100
              return (
                <div key={sev} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                    <span style={{ color: severityColors[sev], fontWeight: 600 }}>{sev}</span>
                    <span style={{ color: '#64748b' }}>{count}</span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 2)}%` }}
                      transition={{ duration: 0.6 }}
                      style={{ height: '100%', background: severityColors[sev], borderRadius: 2 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, flex: 1 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Activity size={11} color="#22c55e" /> Live Activity
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Dispatch Queue', value: '2 pending', color: '#f97316' },
                { label: 'Units Responding', value: activeUnits.length.toString(), color: '#3b82f6' },
                { label: 'Avg Response Time', value: '4m 32s', color: '#60a5fa' },
                { label: 'Hospital Capacity', value: '72%', color: '#22c55e' },
                { label: 'Radio Traffic', value: 'Active', color: '#eab308' },
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
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(124,58,237,0.08) 100%)',
          border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Radio size={14} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 6 }}>
            AI Operations Summary
            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontSize: 9, color: '#22c55e', fontWeight: 400 }}>● ANALYZING</motion.span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
            {metrics.activeIncidents > 0
              ? `${metrics.activeIncidents} active incidents — ${metrics.unitsAvailable} units available for dispatch. ${metrics.hospitalsOnDivert > 0 ? `${metrics.hospitalsOnDivert} hospital(s) on divert.` : 'All hospitals accepting patients.'} ⚡ Peak dispatch window: next 12 minutes.`
              : 'No active incidents. All units standing by.'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#475569', flexShrink: 0 }}>
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}
          />
          Neural Engine v2 · Live
        </div>
      </motion.div>
    </div>
  )
}
