'use client'

import React, { useEffect, useState } from 'react'
import { Settings, Save, RefreshCw, Loader2 } from 'lucide-react'
import { useLocale } from '@/components/i18n/LocaleProvider'

export default function EmsSettingsPage() {
  const { t } = useLocale()
  const [config, setConfig] = useState({
    dispatchMode: 'semi_auto',
    timezone: 'UTC',
    defaultRadioChannel: '',
    autoDispatchThreshold: 0.6,
    responseTimeTarget: 480,
    enableAiClassification: true,
    enableAutoDispatch: false,
    enablePredictiveAlerts: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/ems/settings', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        const s = data?.data || data
        if (s) {
          setConfig({
            dispatchMode: s.dispatchMode || 'semi_auto',
            timezone: s.timezone || 'UTC',
            defaultRadioChannel: s.defaultRadioChannel || '',
            autoDispatchThreshold: s.autoDispatchThreshold ?? 0.6,
            responseTimeTarget: s.responseTimeTarget ?? 480,
            enableAiClassification: s.enableAiClassification ?? true,
            enableAutoDispatch: s.enableAutoDispatch ?? false,
            enablePredictiveAlerts: s.enablePredictiveAlerts ?? true,
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/ems/settings', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Loader2 size={20} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={18} color="#94a3b8" /> {t('ems.settings.title')}
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{t('ems.settings.title')}</p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>{t('ems.dispatch.parameters')}</label>
            <select value={config.dispatchMode} onChange={(e) => setConfig({ ...config, dispatchMode: e.target.value })} style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' }}>
              <option value="manual">Manual — all dispatches require human confirmation</option>
              <option value="semi_auto">Semi-Auto — AI recommends, dispatcher approves</option>
              <option value="auto">Full Auto — AI dispatches for DELTA/ECHO/OMEGA</option>
            </select>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t('ems.dispatch.subtitle')}</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>Timezone</label>
            <select value={config.timezone} onChange={(e) => setConfig({ ...config, timezone: e.target.value })} style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' }}>
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern (US)</option>
              <option value="America/Chicago">Central (US)</option>
              <option value="America/Denver">Mountain (US)</option>
              <option value="America/Los_Angeles">Pacific (US)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>{t('ems.dispatch.radioTitle')}</label>
            <input value={config.defaultRadioChannel} onChange={(e) => setConfig({ ...config, defaultRadioChannel: e.target.value })} placeholder="e.g. CH-1 Dispatch" style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>{t('ems.dispatch.autoDispatch')}</label>
              <input type="number" step="0.05" min="0" max="1" value={config.autoDispatchThreshold} onChange={(e) => setConfig({ ...config, autoDispatchThreshold: parseFloat(e.target.value) || 0 })} style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>{t('timeline.etaUpdate')}</label>
              <input type="number" min="60" max="3600" value={config.responseTimeTarget} onChange={(e) => setConfig({ ...config, responseTimeTarget: parseInt(e.target.value) || 480 })} style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'enableAiClassification', labelKey: 'ems.dispatch.aiRecommend', descKey: 'ems.dispatch.subtitle' },
              { key: 'enableAutoDispatch', labelKey: 'ems.dispatch.autoDispatch', descKey: 'ems.dispatch.subtitle' },
              { key: 'enablePredictiveAlerts', labelKey: 'ems.command.aiSummary', descKey: 'ems.dispatch.subtitle' },
            ].map(({ key, labelKey, descKey }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={(config as any)[key]} onChange={(e) => setConfig({ ...config, [key]: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#3b82f6' }} />
                <div>
                  <div style={{ fontSize: 13, color: '#cbd5e1' }}>{t(labelKey as any)}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{t(descKey as any)}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 22px', background: saved ? '#22c55e' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: 13, fontWeight: 600 }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <RefreshCw size={14} /> : <Save size={14} />}
            {saving ? t('common.saving') : saved ? t('common.saved') : t('common.saveSettings')}
          </button>
        </div>
      </div>
    </div>
  )
}
