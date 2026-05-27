'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, Search, Filter } from 'lucide-react'

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/ems/incidents', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => { setIncidents(Array.isArray(data) ? data : data?.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = incidents.filter((i) =>
    !search || i.incidentNumber?.toLowerCase().includes(search.toLowerCase()) ||
    i.chiefComplaint?.toLowerCase().includes(search.toLowerCase()) ||
    i.address?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Incidents</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{filtered.length} total incidents</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Search size={14} color="#64748b" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search incidents..."
              style={{ background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 13, outline: 'none', width: 200 }}
            />
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
            <AlertTriangle size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>No incidents found</div>
          </div>
        ) : (
          filtered.map((inc) => (
            <div key={inc.id} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{inc.incidentNumber}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{inc.chiefComplaint || 'No complaint'} {inc.address ? `· ${inc.address}` : ''}</div>
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{new Date(inc.createdAt).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
