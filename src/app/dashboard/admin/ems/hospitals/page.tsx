'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Building2, Activity, Ambulance, AlertTriangle, Bed, Phone, Search, RefreshCw } from 'lucide-react'

type Hospital = {
  id: string
  name: string
  code?: string
  status: string
  bedCount: number
  availableBeds: number
  icuBeds: number
  availableIcu: number
  traumaLevel?: number
  waitTimeMinutes?: number
  capabilities?: string[]
  lat: number
  lng: number
  phone?: string
  edPhone?: string
  diversionInfo?: string
  lastUpdated: string
}

const statusConfig: Record<string, { label: string; color: string; pulse?: boolean }> = {
  OPEN: { label: 'Open', color: '#22c55e' },
  DIVERT: { label: 'Divert', color: '#ef4444', pulse: true },
  CONTAINMENT: { label: 'Containment', color: '#f97316' },
  FULL: { label: 'Full', color: '#dc2626' },
  CLOSED: { label: 'Closed', color: '#6b7280' },
}

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchHospitals = useCallback(async () => {
    try {
      const res = await fetch('/api/ems/hospitals', { credentials: 'same-origin' })
      const data = await res.json()
      setHospitals(Array.isArray(data) ? data : data?.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchHospitals(); const iv = setInterval(fetchHospitals, 30000); return () => clearInterval(iv) }, [fetchHospitals])

  const filtered = hospitals.filter((h) =>
    !search || h.name.toLowerCase().includes(search.toLowerCase()) || h.code?.toLowerCase().includes(search.toLowerCase())
  )

  const openCount = hospitals.filter((h) => h.status === 'OPEN').length
  const divertCount = hospitals.filter((h) => h.status === 'DIVERT').length
  const totalBeds = hospitals.reduce((s, h) => s + h.bedCount, 0)
  const availableBeds = hospitals.reduce((s, h) => s + h.availableBeds, 0)

  if (loading) return <LoadingSkeleton />

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} color="#3b82f6" /> Hospital Network
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{hospitals.length} hospitals · {openCount} open · {divertCount} on divert</p>
        </div>
        <button onClick={fetchHospitals} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Beds', value: totalBeds, icon: Bed, color: '#60a5fa' },
          { label: 'Available', value: availableBeds, icon: Activity, color: '#22c55e' },
          { label: 'Open', value: openCount, icon: Building2, color: '#22c55e' },
          { label: 'On Divert', value: divertCount, icon: AlertTriangle, color: '#ef4444' },
          { label: 'Avg Wait', value: hospitals.length > 0 ? `${Math.round(hospitals.reduce((s, h) => s + (h.waitTimeMinutes || 0), 0) / hospitals.length)}m` : '—', icon: Clock, color: '#f97316' },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
              <Icon size={16} color={kpi.color} style={{ marginBottom: 4, opacity: 0.7 }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{kpi.value}</div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)', flex: 1 }}>
          <Search size={14} color="#64748b" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search hospitals..." style={{ background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <EmptyState icon={Building2} message="No hospitals found" />
        ) : (
          filtered.map((h) => {
            const status = statusConfig[h.status] || statusConfig.OPEN
            const bedPct = h.bedCount > 0 ? Math.round((h.availableBeds / h.bedCount) * 100) : 0
            const icuPct = h.icuBeds > 0 ? Math.round((h.availableIcu / h.icuBeds) * 100) : 0
            return (
              <div key={h.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: status.color, boxShadow: status.pulse ? `0 0 8px ${status.color}` : 'none' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0' }}>{h.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 8 }}>
                        {h.code && <span>{h.code}</span>}
                        {h.traumaLevel && <span>Level {h.traumaLevel} Trauma</span>}
                        {h.edPhone && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10} /> {h.edPhone}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: status.color + '20', color: status.color, fontWeight: 600 }}>{status.label}</span>
                    {h.waitTimeMinutes && <span style={{ fontSize: 11, color: '#f97316' }}>{h.waitTimeMinutes}min wait</span>}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                  <StatBar label="General Beds" value={h.availableBeds} total={h.bedCount} pct={bedPct} color="#3b82f6" />
                  <StatBar label="ICU Beds" value={h.availableIcu} total={h.icuBeds} pct={icuPct} color="#8b5cf6" />
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    <div style={{ fontWeight: 500, color: '#94a3b8', marginBottom: 2 }}>Capabilities</div>
                    <div style={{ fontSize: 11 }}>{(h.capabilities || []).slice(0, 3).join(', ') || 'Standard'}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right' }}>
                    <div style={{ fontWeight: 500, color: '#94a3b8', marginBottom: 2 }}>Last Updated</div>
                    <div style={{ fontSize: 11 }}>{new Date(h.lastUpdated).toLocaleTimeString()}</div>
                  </div>
                </div>
                {h.diversionInfo && h.status === 'DIVERT' && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 4, fontSize: 11, color: '#fca5a5' }}>
                    {h.diversionInfo}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function StatBar({ label, value, total, pct, color }: { label: string; value: number; total: number; pct: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{value} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>/ {total}</span></div>
      <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 4 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 100, background: 'rgba(255,255,255,0.02)', borderRadius: 10, marginBottom: 10, border: '1px solid rgba(255,255,255,0.04)' }} />
      ))}
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
      <Icon size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
      <div style={{ fontSize: 13 }}>{message}</div>
    </div>
  )
}

function Clock(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
