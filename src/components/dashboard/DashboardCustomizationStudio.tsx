'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Copy,
  Download,
  Layers3,
  Palette,
  PanelLeft,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react'
import {
  DEFAULT_DASHBOARD_DESIGN_CONFIG,
  normalizeDashboardDesignConfig,
} from '@/lib/dashboard-design'
import { applyLiveDashboardDesign, clearLiveDashboardDesign } from '@/lib/dashboard-theme-runtime'
import { applyUserDashboardDesign } from '@/lib/theme-client'
import type { UserDashboardDesignSettings } from '@/lib/settings'
import { useDashboardDesignStore } from '@/stores/dashboard-design-store'

const THEME_PRESETS = [
  {
    id: 'aurora-command',
    name: 'Aurora Command',
    primary: '#0891b2',
    accent: '#a78bfa',
    background: '#071016',
    card: '#0d1820',
    text: '#f8fafc',
    sidebar: '#081118',
  },
  {
    id: 'graphite-exec',
    name: 'Graphite Exec',
    primary: '#2563eb',
    accent: '#22c55e',
    background: '#f5f7fb',
    card: '#ffffff',
    text: '#0f172a',
    sidebar: '#ffffff',
  },
  {
    id: 'terminal-prime',
    name: 'Terminal Prime',
    primary: '#10b981',
    accent: '#f59e0b',
    background: '#060807',
    card: '#0d1210',
    text: '#ecfdf5',
    sidebar: '#080d0b',
  },
] as const

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      <div className="studio-color-row">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
        <input value={value} maxLength={7} spellCheck={false} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  )
}

function RangeControl({
  label,
  value,
  min,
  max,
  suffix = 'px',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="studio-field">
      <span>
        {label}
        <strong>
          {value}
          {suffix}
        </strong>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function StudioGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Palette
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="studio-group">
      <div className="studio-group-title">
        <Icon size={15} />
        {title}
      </div>
      <div className="studio-group-body">{children}</div>
    </section>
  )
}

export default function DashboardCustomizationStudio() {
  const open = useDashboardDesignStore((state) => state.studioOpen)
  const setOpen = useDashboardDesignStore((state) => state.setStudioOpen)
  const config = useDashboardDesignStore((state) => state.config)
  const patchConfig = useDashboardDesignStore((state) => state.patchConfig)
  const setConfig = useDashboardDesignStore((state) => state.setConfig)
  const setDesign = useDashboardDesignStore((state) => state.setDesign)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const visibleWidgetCount = useMemo(() => config.dashboard.widgets.filter((widget) => widget.visible).length, [config.dashboard.widgets])

  useEffect(() => {
    if (!open) return
    applyLiveDashboardDesign(config)
  }, [config, open])

  useEffect(() => {
    if (!open) clearLiveDashboardDesign()
  }, [open])

  if (!open) return null

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback((current) => (current === message ? null : current)), 3200)
  }

  function applyPreset(preset: (typeof THEME_PRESETS)[number]) {
    setConfig(
      normalizeDashboardDesignConfig({
        ...config,
        palette: {
          ...config.palette,
          primary: preset.primary,
          accent: preset.accent,
          background: preset.background,
          backgroundSoft: preset.background === '#f5f7fb' ? '#eef2f7' : '#101923',
          card: preset.card,
          elevated: preset.background === '#f5f7fb' ? '#f1f5f9' : '#111827',
          sidebar: preset.sidebar,
          sidebarSurface: preset.background === '#f5f7fb' ? '#f8fafc' : 'rgba(255,255,255,0.065)',
          border: preset.background === '#f5f7fb' ? '#d9e2ef' : '#1f2a37',
          text: preset.text,
          textSecondary: preset.background === '#f5f7fb' ? '#334155' : '#cbd5e1',
          textMuted: preset.background === '#f5f7fb' ? '#64748b' : '#94a3b8',
        },
        background: {
          ...config.background,
          style: preset.background === '#f5f7fb' ? 'solid' : 'gradient',
          gradientFrom: preset.background,
          gradientTo: preset.card,
        },
      })
    )
  }

  async function saveDesign() {
    setSaving(true)
    const response = await fetch('/api/settings/design', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ design: config }),
    })
    const data = (await response.json().catch(() => ({}))) as { design?: UserDashboardDesignSettings; error?: string }
    setSaving(false)

    if (!response.ok || !data.design) {
      showFeedback(data.error ?? 'Design could not be saved.')
      return
    }

    clearLiveDashboardDesign()
    setDesign(data.design)
    applyUserDashboardDesign(data.design)
    showFeedback('Design saved to your dashboard.')
  }

  function exportTheme() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${config.brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'dashboard'}-theme.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function importTheme(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setConfig(normalizeDashboardDesignConfig(JSON.parse(String(reader.result))))
        showFeedback('Theme imported into the live preview.')
      } catch {
        showFeedback('Theme file is not valid JSON.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="studio-backdrop" role="dialog" aria-modal="true" aria-label="Dashboard customization studio">
      <button type="button" className="studio-scrim" aria-label="Close customization studio" onClick={() => setOpen(false)} />
      <aside className="studio-panel">
        <header className="studio-header">
          <div>
            <div className="studio-eyebrow">Runtime Studio</div>
            <h2>Customize dashboard</h2>
          </div>
          <button type="button" className="studio-icon-button" onClick={() => setOpen(false)} aria-label="Close customization studio">
            <X size={17} />
          </button>
        </header>

        {feedback && (
          <div className="studio-feedback">
            <CheckCircle2 size={15} />
            {feedback}
          </div>
        )}

        <div className="studio-scroll">
          <StudioGroup icon={Palette} title="Presets">
            <div className="studio-preset-grid">
              {THEME_PRESETS.map((preset) => (
                <button key={preset.id} type="button" onClick={() => applyPreset(preset)}>
                  <span style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }} />
                  {preset.name}
                </button>
              ))}
            </div>
          </StudioGroup>

          <StudioGroup icon={SlidersHorizontal} title="Theme">
            <div className="studio-control-grid">
              <ColorControl label="Primary" value={config.palette.primary} onChange={(value) => patchConfig('palette', { primary: value })} />
              <ColorControl label="Accent" value={config.palette.accent} onChange={(value) => patchConfig('palette', { accent: value })} />
              <ColorControl label="Background" value={config.palette.background} onChange={(value) => patchConfig('palette', { background: value })} />
              <ColorControl label="Cards" value={config.palette.card} onChange={(value) => patchConfig('palette', { card: value })} />
              <ColorControl label="Sidebar" value={config.palette.sidebar} onChange={(value) => patchConfig('palette', { sidebar: value })} />
              <ColorControl label="Text" value={config.palette.text} onChange={(value) => patchConfig('palette', { text: value })} />
            </div>
          </StudioGroup>

          <StudioGroup icon={PanelLeft} title="Layout">
            <div className="studio-segmented">
              {(['contained', 'fluid', 'focus'] as const).map((mode) => (
                <button key={mode} type="button" className={config.layout.layoutMode === mode ? 'active' : ''} onClick={() => patchConfig('layout', { layoutMode: mode })}>
                  {mode}
                </button>
              ))}
            </div>
            <div className="studio-control-grid">
              <RangeControl label="Sidebar" value={config.layout.sidebarWidth} min={220} max={360} onChange={(value) => patchConfig('layout', { sidebarWidth: value })} />
              <RangeControl label="Width" value={config.layout.contentWidth} min={900} max={1600} onChange={(value) => patchConfig('layout', { contentWidth: value })} />
              <RangeControl label="Radius" value={config.layout.cardRadius} min={0} max={24} onChange={(value) => patchConfig('layout', { cardRadius: value })} />
              <RangeControl label="Button" value={config.buttons.radius} min={0} max={24} onChange={(value) => patchConfig('buttons', { radius: value })} />
            </div>
            <div className="studio-segmented">
              {(['solid', 'glass', 'floating'] as const).map((style) => (
                <button key={style} type="button" className={config.layout.sidebarStyle === style ? 'active' : ''} onClick={() => patchConfig('layout', { sidebarStyle: style })}>
                  {style}
                </button>
              ))}
            </div>
          </StudioGroup>

          <StudioGroup icon={Layers3} title="Widgets">
            <div className="studio-widget-summary">
              <strong>{visibleWidgetCount}</strong>
              <span>visible modules</span>
            </div>
            <div className="studio-widget-list">
              {config.dashboard.widgets.map((widget) => (
                <label key={widget.id}>
                  <input
                    type="checkbox"
                    checked={widget.visible}
                    onChange={(event) =>
                      patchConfig('dashboard', {
                        widgets: config.dashboard.widgets.map((item) => (item.id === widget.id ? { ...item, visible: event.target.checked } : item)),
                      })
                    }
                  />
                  <span>{widget.title}</span>
                </label>
              ))}
            </div>
          </StudioGroup>
        </div>

        <footer className="studio-actions">
          <input ref={fileInputRef} type="file" accept="application/json" className="sr-only" onChange={(event) => importTheme(event.target.files?.[0] ?? null)} />
          <button type="button" className="studio-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} />
            Import
          </button>
          <button type="button" className="studio-secondary" onClick={exportTheme}>
            <Download size={15} />
            Export
          </button>
          <button type="button" className="studio-secondary" onClick={() => setConfig(DEFAULT_DASHBOARD_DESIGN_CONFIG)}>
            <RotateCcw size={15} />
            Reset
          </button>
          <button type="button" className="studio-secondary" onClick={() => navigator.clipboard?.writeText(JSON.stringify(config, null, 2)).then(() => showFeedback('Theme JSON copied.'))}>
            <Copy size={15} />
            Copy
          </button>
          <button type="button" className="studio-primary" onClick={saveDesign} disabled={saving}>
            <Save size={15} />
            {saving ? 'Saving' : 'Save'}
          </button>
        </footer>
      </aside>
    </div>
  )
}
