'use client'

import { useEffect, useState } from 'react'
import { formatTimeAgo } from '@/lib/utils'
import { Bell, Clock, Phone, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface Alert {
  id: string; type: string; title: string; message: string; read: boolean; createdAt: string
  sender: { name: string }
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string; border: string; label: string }> = {
  URGENT_TASK: { icon: AlertTriangle, color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', label: 'Urgent Task' },
  DEADLINE_WARNING: { icon: Clock, color: '#d97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.2)', label: 'Deadline' },
  MANAGER_CALL: { icon: Phone, color: '#0e7490', bg: 'rgba(14,116,144,0.09)', border: 'rgba(14,116,144,0.22)', label: 'Manager Call' },
}

export default function EmployeeAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAlerts() {
    const data = await fetch('/api/alerts').then((response) => response.json())
    return Array.isArray(data) ? data : []
  }

  async function markRead(alertId: string) {
    await fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alertId }) })
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a))
  }

  useEffect(() => {
    let active = true

    const loadAlerts = async () => {
      const nextAlerts = await fetchAlerts()
      if (!active) return
      setAlerts(nextAlerts)
      setLoading(false)
    }

    void loadAlerts()

    return () => {
      active = false
    }
  }, [])
  const unread = alerts.filter(a => !a.read).length

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-heading flex flex-wrap items-center gap-2">
          <Bell size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> Alerts
          {unread > 0 && <span style={{ fontSize: '12px', background: 'rgba(239,68,68,0.15)', color: '#f87171', borderRadius: '4px', padding: '2px 8px', fontWeight: '700' }}>{unread} new</span>}
        </h1>
        <p className="page-sub">Notifications from your leads</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : alerts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <Bell size={32} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No alerts yet - you&apos;re all clear</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.map((alert, i) => {
            const cfg = typeConfig[alert.type] || typeConfig.URGENT_TASK
            const Icon = cfg.icon
            return (
              <div key={alert.id} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms`, background: alert.read ? 'var(--bg-card)' : cfg.bg, border: `1px solid ${alert.read ? 'var(--border)' : cfg.border}`, borderRadius: '12px', padding: '16px', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div className="icon-box" style={{ width: '36px', height: '36px', background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <Icon size={16} style={{ color: cfg.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{cfg.label}</span>
                        {!alert.read && <span style={{ width: '6px', height: '6px', background: '#ef4444', borderRadius: '50%' }} />}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{formatTimeAgo(alert.createdAt)}</span>
                    </div>
                    <h3 style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{alert.title}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '8px' }}>{alert.message}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From <strong style={{ color: 'var(--text-secondary)' }}>{alert.sender?.name}</strong></span>
                      {!alert.read && (
                        <button onClick={() => markRead(alert.id)} style={{ fontSize: '11px', color: 'var(--accent-hover)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
