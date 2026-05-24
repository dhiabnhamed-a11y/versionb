'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Info, Bell, RefreshCw } from 'lucide-react'

type AlertItem = {
  id: string
  type: string
  severity: string
  title: string
  description: string
  entityType: string
  entityId: string
  aiConfidence: number
  createdAt: string
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/erp2/ai/anomalies?unresolved=true')
      const json = await res.json()
      if (json.success) {
        setAlerts(json.data.alerts)
      } else {
        setError('Failed to load alerts')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAlerts() }, [])

  const handleResolve = async (id: string) => {
    await fetch(`/api/v1/erp2/alerts/${id}?action=resolve`, { method: 'PATCH' })
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const handleRunScan = async () => {
    setLoading(true)
    await fetch('/api/v1/erp2/ai/anomalies', { method: 'POST' })
    await fetchAlerts()
  }

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <AlertTriangle size={14} color="#dc2626" />
      case 'WARNING': return <Info size={14} color="#d97706" />
      default: return <CheckCircle size={14} color="#16a34a" />
    }
  }

  const severityBg = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return '#fef2f2'
      case 'WARNING': return '#fffbeb'
      default: return '#f0fdf4'
    }
  }

  const severityBorder = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return '#fecaca'
      case 'WARNING': return '#fde68a'
      default: return '#bbf7d0'
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>AI Anomaly Alerts</h1>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            {alerts.length > 0
              ? `${alerts.length} unresolved alert${alerts.length !== 1 ? 's' : ''} detected by AI`
              : 'No anomalies detected. Your books look clean.'}
          </p>
        </div>
        <button
          onClick={handleRunScan}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: '#3b82f6', color: '#fff', fontSize: '13px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Run AI Scan
        </button>
      </div>

      {loading && alerts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>
          Loading alerts...
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {!loading && !error && alerts.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0',
          padding: '40px', textAlign: 'center',
        }}>
          <Bell size={32} color="#16a34a" style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>No alerts</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            AI has not detected any anomalies. Run a scan to check your recent transactions.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {alerts.map((alert) => (
          <div
            key={alert.id}
            style={{
              background: severityBg(alert.severity),
              borderRadius: '8px',
              border: `1px solid ${severityBorder(alert.severity)}`,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <div style={{ marginTop: '1px' }}>{severityIcon(alert.severity)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{alert.title}</span>
                <span style={{
                  fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
                  padding: '1px 6px', borderRadius: '4px',
                  background: alert.severity === 'CRITICAL' ? '#fecaca' : alert.severity === 'WARNING' ? '#fde68a' : '#bbf7d0',
                  color: alert.severity === 'CRITICAL' ? '#991b1b' : alert.severity === 'WARNING' ? '#78350f' : '#166534',
                }}>
                  {alert.severity}
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {(alert.aiConfidence * 100).toFixed(0)}% confidence
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>{alert.description}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#94a3b8' }}>
                <span>{new Date(alert.createdAt).toLocaleString()}</span>
                <button
                  onClick={() => handleResolve(alert.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#3b82f6', fontSize: '11px', fontWeight: 600, padding: 0,
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
