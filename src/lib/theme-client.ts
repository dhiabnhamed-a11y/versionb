'use client'

import type { WorkspaceThemeSettings } from '@/lib/settings'

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function hexToRgb(hex: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '0369a1'
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function mixWith(hex: string, target: number, weight: number) {
  const color = hexToRgb(hex)
  const r = clampChannel(color.r + (target - color.r) * weight)
  const g = clampChannel(color.g + (target - color.g) * weight)
  const b = clampChannel(color.b + (target - color.b) * weight)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function rgba(hex: string, alpha: number) {
  const color = hexToRgb(hex)
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

export function applyWorkspaceTheme(settings: WorkspaceThemeSettings) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const isDark = settings.themeMode === 'dark'
  const hover = mixWith(settings.primaryColor, isDark ? 255 : 0, 0.16)

  root.dataset.theme = settings.themeMode
  root.style.setProperty('--accent', settings.primaryColor)
  root.style.setProperty('--primary', settings.primaryColor)
  root.style.setProperty('--accent-bright', mixWith(settings.primaryColor, 255, 0.18))
  root.style.setProperty('--accent-hover', hover)
  root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${settings.primaryColor} 0%, ${hover} 100%)`)
  root.style.setProperty('--accent-glow', rgba(settings.primaryColor, 0.16))
  root.style.setProperty('--accent-ring', rgba(settings.primaryColor, 0.32))
  root.style.setProperty('--accent-subtle', rgba(settings.primaryColor, isDark ? 0.18 : 0.08))
  root.style.setProperty('--bg-primary', settings.backgroundColor)
  root.style.setProperty('--bg', settings.backgroundColor)
  root.style.setProperty('--sidebar-bg', settings.sidebarColor)
  root.style.setProperty('--sidebar', settings.sidebarColor)

  if (isDark) {
    root.style.setProperty('--bg-secondary', mixWith(settings.backgroundColor, 255, 0.08))
    root.style.setProperty('--bg-card', '#111827')
    root.style.setProperty('--bg-elevated', '#1f2937')
    root.style.setProperty('--border', '#334155')
    root.style.setProperty('--border-light', '#475569')
    root.style.setProperty('--text-primary', '#f8fafc')
    root.style.setProperty('--text-secondary', '#cbd5e1')
    root.style.setProperty('--text-muted', '#94a3b8')
    root.style.setProperty('--text-light', '#64748b')
    root.style.setProperty('--sidebar-surface', 'rgba(255,255,255,0.06)')
    root.style.setProperty('--sidebar-border', 'rgba(255,255,255,0.12)')
    root.style.setProperty('--sidebar-text', '#cbd5e1')
    root.style.setProperty('--sidebar-text-active', '#f8fafc')
    root.style.setProperty('--sidebar-hover', 'rgba(255,255,255,0.08)')
    root.style.setProperty('--sidebar-active-bg', rgba(settings.primaryColor, 0.18))
    root.style.setProperty('--sidebar-active-border', rgba(settings.primaryColor, 0.32))
    return
  }

  root.style.setProperty('--bg-secondary', '#eef1f5')
  root.style.setProperty('--bg-card', '#ffffff')
  root.style.setProperty('--bg-elevated', '#f3f5f8')
  root.style.setProperty('--border', '#e2e7ee')
  root.style.setProperty('--border-light', '#d3dbe6')
  root.style.setProperty('--text-primary', '#0b1628')
  root.style.setProperty('--text-secondary', '#2e4060')
  root.style.setProperty('--text-muted', '#64748b')
  root.style.setProperty('--text-light', '#94a3b8')
  root.style.setProperty('--sidebar-surface', '#f6f8fb')
  root.style.setProperty('--sidebar-border', '#e6ebf2')
  root.style.setProperty('--sidebar-text', '#5f6f85')
  root.style.setProperty('--sidebar-text-active', '#0b1628')
  root.style.setProperty('--sidebar-hover', '#f3f6fa')
  root.style.setProperty('--sidebar-active-bg', rgba(settings.primaryColor, 0.08))
  root.style.setProperty('--sidebar-active-border', rgba(settings.primaryColor, 0.24))
}
