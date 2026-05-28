'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plug, Plus, Power, PowerOff, RefreshCw, TestTube, Trash2, Cable, Wifi, WifiOff, AlertCircle, CheckCircle2, Loader2, Activity, Database, ArrowLeft, ExternalLink, FileJson, Link2, Radio, Building2, Users, Heart, MapPin, Webhook } from 'lucide-react'
import { useLocale } from '@/components/i18n/LocaleProvider'
import type { EmsIntegrationType } from '@/lib/ems/integration'

interface Integration {
  id: string
  name: string
  type: EmsIntegrationType
  status: string
  endpointUrl: string | null
  authType: string | null
  isEnabled: boolean
  lastConnectedAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  errorCount: number
  pollingEnabled: boolean
  createdAt: string
  health: {
    status: string
    lastConnectedAt: string | null
    lastErrorAt: string | null
    lastErrorMessage: string | null
    latencyMs: number | null
    eventsProcessed: number
    eventsFailed: number
  } | null
  fieldMappings: any[]
  webhookConfigs: any[]
  _count: { integrationEvents: number; auditLogs: number }
}

interface IntegrationStatus {
  total: number
  connected: number
  error: number
  disconnected: number
  pending: number
  integrations: Integration[]
}

const INTEGRATION_TYPE_ICONS: Record<string, React.ElementType> = {
  CAD: Radio,
  EHR: Heart,
  FHIR: Database,
  HL7: FileJson,
  AVL: MapPin,
  CUSTOM: Link2,
}

const INTEGRATION_TYPE_COLORS: Record<string, string> = {
  CAD: '#3b82f6',
  EHR: '#ef4444',
  FHIR: '#10b981',
  HL7: '#8b5cf6',
  AVL: '#f59e0b',
  CUSTOM: '#64748b',
}

function getTypeGroup(type: EmsIntegrationType): string {
  if (type.startsWith('CAD_')) return 'CAD'
  if (type.startsWith('EHR_')) return 'EHR'
  if (type === 'FHIR') return 'FHIR'
  if (type === 'HL7') return 'HL7'
  if (type === 'AVL_GPS') return 'AVL'
  return 'CUSTOM'
}

function getTypeIcon(type: EmsIntegrationType): React.ElementType {
  const group = getTypeGroup(type)
  return INTEGRATION_TYPE_ICONS[group] || Plug
}

function getTypeColor(type: EmsIntegrationType): string {
  const group = getTypeGroup(type)
  return INTEGRATION_TYPE_COLORS[group] || '#64748b'
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'CONNECTED': return '#22c55e'
    case 'ERROR': return '#ef4444'
    case 'DISCONNECTED': return '#64748b'
    case 'PENDING': return '#f59e0b'
    case 'CONFIGURING': return '#3b82f6'
    default: return '#64748b'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'CONNECTED': return <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
    case 'ERROR': return <AlertCircle size={14} style={{ color: '#ef4444' }} />
    case 'DISCONNECTED': return <WifiOff size={14} style={{ color: '#64748b' }} />
    case 'PENDING': return <Loader2 size={14} style={{ color: '#f59e0b' }} />
    default: return <Wifi size={14} style={{ color: '#3b82f6' }} />
  }
}

function IntegrationCreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<EmsIntegrationType>('CAD_CUSTOM')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [authType, setAuthType] = useState('none')
  const [apiKey, setApiKey] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/ems/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, endpointUrl, authType, apiKey }),
      })
      if (res.ok) {
        onCreated()
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '520px' }}>
        <h2 className="font-display mb-2 text-lg font-semibold tracking-tight">New Integration</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '18px' }}>
          Connect to a CAD system, EHR, FHIR server, or custom API
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Motorola CAD - County" required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>Type *</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as EmsIntegrationType)}>
              <optgroup label="CAD Systems">
                <option value="CAD_MOTOROLA">Motorola CAD</option>
                <option value="CAD_HEXAGON">Hexagon CAD</option>
                <option value="CAD_TYLER">Tyler CAD</option>
                <option value="CAD_CENTRAL_SQUARE">CentralSquare CAD</option>
                <option value="CAD_ZOLL">Zoll Dispatch</option>
                <option value="CAD_RAPID_SOS">RapidSOS</option>
                <option value="CAD_CUSTOM">Custom CAD</option>
              </optgroup>
              <optgroup label="EHR Systems">
                <option value="EHR_EPIC">Epic EHR</option>
                <option value="EHR_CERNER">Cerner EHR</option>
                <option value="EHR_ALLSCRIPTS">Allscripts EHR</option>
                <option value="EHR_MEDITECH">Meditech EHR</option>
                <option value="EHR_CUSTOM">Custom EHR</option>
              </optgroup>
              <optgroup label="Standards">
                <option value="FHIR">FHIR R4</option>
                <option value="HL7">HL7 v2/v3</option>
              </optgroup>
              <optgroup label="Infrastructure">
                <option value="AVL_GPS">AVL/GPS Telemetry</option>
                <option value="CUSTOM_API">Custom REST API</option>
                <option value="CUSTOM_WEBHOOK">Custom Webhook</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>Endpoint URL</label>
            <input className="input" value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="https://cad.example.com/api" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>Auth Type</label>
            <select className="input" value={authType} onChange={(e) => setAuthType(e.target.value)}>
              <option value="none">None</option>
              <option value="api_key">API Key</option>
              <option value="basic">Basic Auth</option>
              <option value="oauth2">OAuth 2.0</option>
            </select>
          </div>
          {authType === 'api_key' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>API Key</label>
              <input className="input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
            </div>
          )}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting || !name} style={{ fontSize: '12px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
              Create Integration
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function IntegrationDetail({ integration, onBack, onRefresh }: { integration: Integration; onBack: () => void; onRefresh: () => void }) {
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; latencyMs?: number } | null>(null)

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/ems/integrations/${integration.id}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResult(data)
      onRefresh()
    } finally {
      setTesting(false)
    }
  }, [integration.id, onRefresh])

  const handleSync = useCallback(async (entityType: string) => {
    setSyncing(true)
    try {
      await fetch(`/api/ems/integrations/${integration.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType }),
      })
      onRefresh()
    } finally {
      setSyncing(false)
    }
  }, [integration.id, onRefresh])

  const handleToggle = useCallback(async () => {
    await fetch(`/api/ems/integrations/${integration.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: !integration.isEnabled }),
    })
    onRefresh()
  }, [integration.id, integration.isEnabled, onRefresh])

  const Icon = getTypeIcon(integration.type)
  const color = getTypeColor(integration.type)

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: '16px' }}>
        <ArrowLeft size={14} /> Back to integrations
      </button>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>{integration.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                {integration.type.replace(/_/g, ' ')}
                <span style={{ color: getStatusColor(integration.status), fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {getStatusIcon(integration.status)} {integration.status}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleTest} disabled={testing} className="btn-secondary" style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {testing ? <Loader2 size={12} className="animate-spin" /> : <TestTube size={12} />}
              Test
            </button>
            <button onClick={() => handleSync('incidents')} disabled={syncing} className="btn-secondary" style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Sync
            </button>
            <button onClick={handleToggle} className="btn-secondary" style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', color: integration.isEnabled ? '#ef4444' : '#22c55e' }}>
              {integration.isEnabled ? <PowerOff size={12} /> : <Power size={12} />}
              {integration.isEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>

        {testResult && (
          <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: testResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${testResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', fontWeight: 500, color: testResult.success ? '#22c55e' : '#ef4444' }}>
              {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {testResult.message || (testResult.success ? 'Connected' : 'Failed')}
              {testResult.latencyMs !== undefined && (
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({testResult.latencyMs}ms)</span>
              )}
            </div>
          </div>
        )}
      </div>

      {integration.health && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={14} /> Connection Health
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Latency</div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginTop: 4 }}>{integration.health.latencyMs !== null ? `${integration.health.latencyMs}ms` : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Events Processed</div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginTop: 4 }}>{integration.health.eventsProcessed}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Events Failed</div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginTop: 4, color: integration.health.eventsFailed > 0 ? '#ef4444' : 'inherit' }}>{integration.health.eventsFailed}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Connected</div>
              <div style={{ fontSize: '13px', fontWeight: 500, marginTop: 4 }}>{integration.health.lastConnectedAt ? new Date(integration.health.lastConnectedAt).toLocaleString() : 'Never'}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Database size={14} /> Field Mappings ({integration.fieldMappings.length})
        </h3>
        {integration.fieldMappings.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No field mappings configured yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {integration.fieldMappings.map((mapping: any) => (
              <div key={mapping.id} style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-elevated)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{mapping.name}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{mapping.entityType}</span>
                </div>
                <span style={{ color: mapping.isActive ? '#22c55e' : '#64748b', fontSize: '11px' }}>{mapping.isActive ? 'Active' : 'Inactive'} v{mapping.version}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Webhook size={14} /> Webhook Configs ({integration.webhookConfigs.length})
        </h3>
        {integration.webhookConfigs.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No webhook endpoints configured.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {integration.webhookConfigs.map((wh: any) => (
              <div key={wh.id} style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-elevated)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{wh.name}</span>
                  {wh.path && <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'monospace' }}>/{wh.path}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: wh.isEnabled ? '#22c55e' : '#64748b' }}>{wh.isEnabled ? 'Active' : 'Disabled'}</span>
                  {wh.maxRetries > 0 && <span style={{ color: 'var(--text-muted)' }}>{wh.maxRetries} retries</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const { data: session } = useSession()
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ems/integrations', { credentials: 'same-origin' })
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete integration "${name}"? This cannot be undone.`)) return
    await fetch(`/api/ems/integrations?id=${id}`, { method: 'DELETE' })
    fetchStatus()
  }, [fetchStatus])

  if (selectedIntegration) {
    return (
      <div style={{ padding: '24px', maxWidth: '860px' }}>
        <IntegrationDetail integration={selectedIntegration} onBack={() => setSelectedIntegration(null)} onRefresh={fetchStatus} />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '960px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <Cable size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> Enterprise Integrations
          </h1>
          <p className="page-sub" style={{ marginTop: 4 }}>
            Connect CAD systems, EHRs, FHIR servers, and external APIs
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ fontSize: '12px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> New Integration
        </button>
      </div>

      {status && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: 4 }}>{status.total}</div>
          </div>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Connected</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: 4, color: '#22c55e' }}>{status.connected}</div>
          </div>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Errors</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: 4, color: status.error > 0 ? '#ef4444' : 'inherit' }}>{status.error}</div>
          </div>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Disconnected</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: 4, color: '#64748b' }}>{status.disconnected}</div>
          </div>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: 4, color: '#f59e0b' }}>{status.pending}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : !status || status.integrations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <Cable size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 10px', display: 'block' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 6 }}>No Integrations Configured</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px', maxWidth: '400px', margin: '0 auto 16px' }}>
            Connect your first CAD system, EHR, or external API to start ingesting real incident, unit, and patient data.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}>
            <Plus size={14} style={{ marginRight: 6 }} /> Create Integration
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {status.integrations.map((integration) => {
            const Icon = getTypeIcon(integration.type)
            const color = getTypeColor(integration.type)
            return (
              <div
                key={integration.id}
                className="card card-interactive animate-fade-in"
                onClick={() => setSelectedIntegration(integration)}
                style={{ cursor: 'pointer', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{integration.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 1 }}>
                      {integration.type.replace(/_/g, ' ')}
                      {integration.endpointUrl && <span style={{ marginLeft: 6, opacity: 0.6 }}>— {integration.endpointUrl}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px' }}>
                    {getStatusIcon(integration.status)}
                    <span style={{ color: getStatusColor(integration.status), fontWeight: 600 }}>{integration.status}</span>
                  </div>
                  {integration.health?.latencyMs !== null && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{integration.health?.latencyMs}ms</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(integration.id, integration.name) }}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <IntegrationCreateForm onClose={() => setShowCreate(false)} onCreated={fetchStatus} />
      )}
    </div>
  )
}
