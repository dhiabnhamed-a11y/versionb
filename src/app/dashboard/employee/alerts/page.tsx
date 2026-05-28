'use client'

import { useEffect, useState } from 'react'
import { formatTimeAgo } from '@/lib/utils'
import { useLocale } from '@/components/i18n/LocaleProvider'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import type { RealtimeEventName } from '@/lib/realtime-events'
import { Bell, Clock, Phone, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { alertsApi, type AlertRecord } from '@/lib/api-client/alerts'

type Alert = AlertRecord

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string; border: string }> = {
  URGENT_TASK: { icon: AlertTriangle, color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' },
  DEADLINE_WARNING: { icon: Clock, color: '#d97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.2)' },
  MANAGER_CALL: { icon: Phone, color: '#0e7490', bg: 'rgba(14,116,144,0.09)', border: 'rgba(14,116,144,0.22)' },
}

const ALERT_REALTIME_EVENTS = ['alert', 'alert_read'] as const

export default function EmployeeAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLocale()
  const typeLabel: Record<string, string> = {
    URGENT_TASK: t('employee.alerts.urgentTask'),
    DEADLINE_WARNING: t('employee.alerts.deadline'),
    MANAGER_CALL: t('employee.alerts.managerCall'),
  }

  async function fetchAlerts() {
    return alertsApi.list()
  }

  async function markRead(alertId: string) {
    await alertsApi.markRead(alertId)
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

  useRealtimeSubscription(
    ALERT_REALTIME_EVENTS,
    (eventName: RealtimeEventName, payload: unknown) => {
      if (eventName === 'alert' && payload && typeof payload === 'object' && 'id' in payload) {
        const alert = payload as Alert
        setAlerts((current) => [alert, ...current.filter((item) => item.id !== alert.id)].slice(0, 50))
        setLoading(false)
        return
      }

      if (eventName === 'alert_read' && payload && typeof payload === 'object' && 'alertId' in payload) {
        const alertId = (payload as { alertId?: unknown }).alertId
        if (typeof alertId === 'string') {
          setAlerts((current) => current.map((alert) => (alert.id === alertId ? { ...alert, read: true } : alert)))
        }
        return
      }

      if (eventName === 'workspace_event') {
        void fetchAlerts().then((nextAlerts) => {
          setAlerts(nextAlerts)
          setLoading(false)
        })
      }
    },
    100
  )

  const unread = alerts.filter(a => !a.read).length

  return (
    <div className="dashboard-page" style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-heading flex flex-wrap items-center gap-2">
          <Bell size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> {t('employee.alerts.title')}
          {unread > 0 && <span className="alert-banner alert-danger" style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span className="status-dot status-dot-danger" style={{ width: '6px', height: '6px' }} />{t('employee.alerts.new').replace('{unread}', unread.toString())}</span>}
        </h1>
        <p className="page-sub">{t('employee.alerts.subtitle')}</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : alerts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <Bell size={32} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('employee.alerts.empty')}</p>
        </div>
      ) : (
        <div className="dashboard-card-stack">
          {alerts.map((alert, i) => {
            const cfg = typeConfig[alert.type] || typeConfig.URGENT_TASK
            const Icon = cfg.icon
            return (
              <div key={alert.id} className="card-interactive animate-fade-in" style={{ animationDelay: `${i * 40}ms`, background: alert.read ? 'var(--bg-card)' : cfg.bg, border: `1px solid ${alert.read ? 'var(--border)' : cfg.border}`, borderRadius: '12px', padding: '16px', transition: 'all 0.2s', borderLeft: alert.read ? undefined : `3px solid ${cfg.color}` }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div className="icon-box" style={{ width: '36px', height: '36px', background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <Icon size={16} style={{ color: cfg.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: cfg.color }}><span className="status-dot" style={{ width: '6px', height: '6px', background: cfg.color, boxShadow: `0 0 0 3px ${cfg.border}` }} />{typeLabel[alert.type]}</span>
                        {!alert.read && <span style={{ width: '6px', height: '6px', background: '#ef4444', borderRadius: '50%', animation: 'pulse 2s infinite' }} />}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{formatTimeAgo(alert.createdAt)}</span>
                    </div>
                    <h3 style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{alert.title}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '8px' }}>{alert.message}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From <strong style={{ color: 'var(--text-secondary)' }}>{alert.sender?.name}</strong></span>
                      {!alert.read && (
                        <button onClick={() => markRead(alert.id)} className="btn-sm" style={{ fontSize: '11px', color: 'var(--success)', background: 'rgba(5,150,105,0.06)', border: '1px solid var(--success-border)', borderRadius: '6px', cursor: 'pointer', fontWeight: '650', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}>
                          <CheckCircle2 size={12} /> {t('employee.alerts.markRead')}
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
