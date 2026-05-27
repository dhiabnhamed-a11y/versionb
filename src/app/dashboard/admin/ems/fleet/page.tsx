'use client'

import React, { useEffect, useState } from 'react'
import { Truck, Wrench, Battery, Signal, MapPin } from 'lucide-react'

export default function FleetPage() {
  const [data, setData] = useState<any>({ units: [], summary: {} })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ems/fleet', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => { setData(d?.data || d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Fleet Management</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Track, manage, and maintain your EMS fleet</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Units', value: data.summary?.total ?? '—', color: '#60a5fa' },
          { label: 'Available', value: data.summary?.available ?? '—', color: '#22c55e' },
          { label: 'Dispatched', value: data.summary?.dispatched ?? '—', color: '#3b82f6' },
          { label: 'On Scene', value: data.summary?.onScene ?? '—', color: '#ef4444' },
          { label: 'Transporting', value: data.summary?.transporting ?? '—', color: '#f97316' },
          { label: 'Offline', value: data.summary?.offline ?? '—', color: '#6b7280' },
        ].map((s) => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={14} color="#3b82f6" /> Unit Roster
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading fleet data...</div>
        ) : (
          (data.units || []).map((unit: any) => (
            <div key={unit.id} style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: unit.status === 'AVAILABLE' ? '#22c55e' : unit.status === 'DISPATCHED' ? '#3b82f6' : '#6b7280',
              }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0', minWidth: 80 }}>{unit.unitNumber}</span>
              <span style={{ fontSize: 11, color: '#64748b', flex: 1 }}>{unit.type?.replace(/_/g, ' ') || '—'}</span>
              <span style={{ fontSize: 11, color: unit.isOnline ? '#22c55e' : '#ef4444' }}>{unit.isOnline ? 'Online' : 'Offline'}</span>
              {unit.lat && unit.lng && <MapPin size={12} color="#64748b" />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
