'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Truck, ShieldCheck, MapPin, Users, Wrench, Search, RefreshCw, Battery, Signal } from 'lucide-react'

type Unit = {
  id: string
  unitNumber: string
  type: string
  status: string
  isOnline: boolean
  lat?: number
  lng?: number
  batteryLevel?: number
  station?: { name: string; code?: string }
  crewMembers: Array<{ role: string; status: string; crew?: { name: string } }>
}

const statusColors: Record<string, string> = {
  AVAILABLE: '#22c55e', DISPATCHED: '#3b82f6', EN_ROUTE: '#f97316',
  ON_SCENE: '#ef4444', TRANSPORTING: '#eab308', AT_HOSPITAL: '#8b5cf6',
  DECONTAMINATION: '#06b6d4', MAINTENANCE: '#6b7280', OFFLINE: '#374151', RESERVE: '#9ca3af',
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch('/api/ems/units', { credentials: 'same-origin' })
      const data = await res.json()
      setUnits(Array.isArray(data) ? data : data?.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchUnits(); const iv = setInterval(fetchUnits, 15000); return () => clearInterval(iv) }, [fetchUnits])

  const filtered = units.filter((u) => {
    if (filter !== 'all' && u.status !== filter) return false
    if (search && !u.unitNumber.toLowerCase().includes(search.toLowerCase()) && !u.station?.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return <LoadingSkeleton />

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={18} color="#3b82f6" /> Fleet Units
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{units.length} total · {units.filter((u) => u.status === 'AVAILABLE').length} available</p>
        </div>
        <button onClick={fetchUnits} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)', flex: 1, minWidth: 200 }}>
          <Search size={14} color="#64748b" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search units..." style={{ background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%' }} />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' }}>
          <option value="all">All Status</option>
          <option value="AVAILABLE">Available</option>
          <option value="DISPATCHED">Dispatched</option>
          <option value="EN_ROUTE">En Route</option>
          <option value="ON_SCENE">On Scene</option>
          <option value="TRANSPORTING">Transporting</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="OFFLINE">Offline</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}><EmptyState icon={Truck} message="No units match your filters" /></div>
        ) : (
          filtered.map((u) => (
            <div key={u.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[u.status] || '#6b7280', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{u.unitNumber}</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: statusColors[u.status] + '20', color: statusColors[u.status], fontWeight: 600 }}>{u.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {u.isOnline ? <Signal size={12} color="#22c55e" /> : <Signal size={12} color="#ef4444" />}
                  {u.batteryLevel !== null && u.batteryLevel !== undefined && (
                    <span style={{ fontSize: 10, color: u.batteryLevel < 20 ? '#ef4444' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Battery size={10} /> {Math.round(u.batteryLevel)}%
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span>{u.type.replace(/_/g, ' ')}</span>
                {u.station && <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><MapPin size={10} /> {u.station.name}</span>}
                {u.lat && u.lng && <span>{u.lat.toFixed(4)}, {u.lng.toFixed(4)}</span>}
              </div>
              {u.crewMembers.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Users size={11} />
                  {u.crewMembers.map((m, i) => (
                    <span key={i} style={{ background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 3 }}>{m.role}</span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ height: 100, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }} />
        ))}
      </div>
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
