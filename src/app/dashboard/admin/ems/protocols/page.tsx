'use client'

import React, { useEffect, useState } from 'react'
import { FileText, Search, Plus } from 'lucide-react'

export default function ProtocolsPage() {
  const [protocols, setProtocols] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/ems/protocols', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => { setProtocols(Array.isArray(data) ? data : data?.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = protocols.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code?.toLowerCase().includes(search.toLowerCase()) || p.type?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="#94a3b8" /> Protocols
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Medical protocols, SOPs, and operational procedures</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)', flex: 1 }}>
          <Search size={14} color="#64748b" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search protocols..." style={{ background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%' }} />
        </div>
      </div>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading protocols...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
          {filtered.map((p) => (
            <div key={p.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <FileText size={14} color="#94a3b8" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{p.name}</div>
                  {p.code && <div style={{ fontSize: 11, color: '#64748b' }}>{p.code} v{p.version}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>{p.type}</span>
                {p.severity && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>{p.severity}</span>}
                {p.isActive && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(34,197,94,0.15)', color: '#86efac' }}>Active</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
