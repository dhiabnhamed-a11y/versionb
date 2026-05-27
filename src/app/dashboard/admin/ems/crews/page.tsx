'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Users, ShieldCheck, AlertTriangle, Search, RefreshCw } from 'lucide-react'
import { useLocale } from '@/components/i18n/LocaleProvider'

type Crew = {
  id: string
  name: string
  code?: string
  type: string
  isActive: boolean
  members: Array<{ role: string; status: string; unit?: { unitNumber: string }; certified: boolean }>
}

export default function CrewsPage() {
  const { t } = useLocale()
  const [crews, setCrews] = useState<Crew[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchCrews = useCallback(async () => {
    try {
      const res = await fetch('/api/ems/crews', { credentials: 'same-origin' })
      const data = await res.json()
      setCrews(Array.isArray(data) ? data : data?.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCrews() }, [fetchCrews])

  const filtered = crews.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code?.toLowerCase().includes(search.toLowerCase())
  )
  const totalMembers = crews.reduce((s, c) => s + c.members.length, 0)
  const availableMembers = crews.reduce((s, c) => s + c.members.filter((m) => m.status === 'available').length, 0)

  if (loading) return <div style={{ padding: 24, color: '#64748b', fontSize: 13 }}>{t('common.loading')}</div>

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="#8b5cf6" /> {t('ems.crews.title')}
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{crews.length} {t('ems.crews.title')} · {totalMembers} {t('common.members')} · {availableMembers} {t('status.available')}</p>
        </div>
        <button onClick={fetchCrews} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
          <RefreshCw size={14} /> {t('common.refresh')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)', flex: 1 }}>
          <Search size={14} color="#64748b" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search') + '...'} style={{ background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#475569' }}>
            <Users size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>{t('common.noResults')}</div>
          </div>
        ) : (
          filtered.map((crew) => (
            <div key={crew.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0' }}>{crew.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{crew.code} · {crew.type}</div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: crew.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: crew.isActive ? '#22c55e' : '#6b7280', fontWeight: 600 }}>
                  {crew.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {crew.members.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShieldCheck size={11} color={m.certified ? '#22c55e' : '#ef4444'} />
                      <span style={{ color: '#cbd5e1' }}>{m.role}</span>
                      {m.unit && <span style={{ color: '#64748b' }}>· {m.unit.unitNumber}</span>}
                    </div>
                    <span style={{ color: m.status === 'available' ? '#22c55e' : '#64748b' }}>{m.status}</span>
                  </div>
                ))}
                {crew.members.length === 0 && <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: 8 }}>{t('common.noResults')}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
