'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Workflow, Plus, ToggleLeft, ToggleRight, Trash2, Loader2 } from 'lucide-react'
import { useLocale } from '@/components/i18n/LocaleProvider'

interface Rule {
  id: string
  name: string
  trigger: string
  conditions: any
  actions: any
  isActive: boolean
  priority: number
}

export default function AutomationPage() {
  const { t } = useLocale()
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/ems/automation', { credentials: 'same-origin' })
      const data = await res.json()
      setRules(Array.isArray(data) ? data : data?.data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const toggleRule = async (id: string, isActive: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive } : r)))
    await fetch('/api/ems/automation', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive }),
    })
  }

  const deleteRule = async (id: string) => {
    await fetch(`/api/ems/automation?id=${id}`, { method: 'DELETE', credentials: 'same-origin' })
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Loader2 size={20} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Workflow size={18} color="#8b5cf6" /> {t('ems.automation.title')}
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{t('ems.dispatch.subtitle')}</p>
        </div>
      </div>
      {rules.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
          {t('common.noResults')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map((rule) => {
            const triggerLabel = rule.trigger || '—'
            const conditionsLabel = typeof rule.conditions === 'string' ? rule.conditions : Array.isArray(rule.conditions) ? rule.conditions.map((c: any) => c.field || c.condition || JSON.stringify(c)).join(', ') : '—'
            const actionsLabel = Array.isArray(rule.actions) ? rule.actions.map((a: any) => a.type || a.action || JSON.stringify(a)).join(', ') : typeof rule.actions === 'string' ? rule.actions : '—'
            return (
              <div key={rule.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Workflow size={14} color="#8b5cf6" />
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{rule.name}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: rule.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: rule.isActive ? '#22c55e' : '#6b7280' }}>{rule.isActive ? t('common.active') : t('common.inactive')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ background: 'transparent', border: 'none', color: rule.isActive ? '#22c55e' : '#6b7280', cursor: 'pointer' }} onClick={() => toggleRule(rule.id, !rule.isActive)}>
                      {rule.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                    <button style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer' }} onClick={() => deleteRule(rule.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 11, color: '#64748b' }}>
                  <div><span style={{ color: '#94a3b8' }}>Trigger:</span> {triggerLabel}</div>
                  <div><span style={{ color: '#94a3b8' }}>Condition:</span> {conditionsLabel}</div>
                  <div><span style={{ color: '#94a3b8' }}>Action:</span> {actionsLabel}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
