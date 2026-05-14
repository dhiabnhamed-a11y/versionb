'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  BadgeCheck,
  Box,
  Check,
  ChevronDown,
  Clipboard,
  Eye,
  Image as ImageIcon,
  Layers,
  Loader2,
  Paintbrush,
  PanelLeft,
  PanelRight,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Type,
  Undo2,
  UploadCloud,
} from 'lucide-react'

import {
  DEFAULT_DASHBOARD_DESIGN_CONFIG,
  normalizeDashboardDesignConfig,
  type DashboardDesignConfig,
} from '@/lib/dashboard-design'
import type { UserDashboardDesignSettings } from '@/lib/settings'
import { applyUserDashboardDesign } from '@/lib/theme-client'

type PaletteKey =
  | 'primary'
  | 'accent'
  | 'background'
  | 'surface'
  | 'card'
  | 'border'
  | 'textMain'
  | 'textMuted'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'

type FontChoice = 'Geist' | 'Instrument Sans' | 'DM Sans' | 'Manrope' | 'Space Grotesk' | 'Inter' | 'JetBrains Mono' | 'IBM Plex Mono'
type GradientMode = 'solid' | 'twoStop' | 'mesh'
type Density = 'compact' | 'comfortable' | 'spacious'
type NavStyle = 'icons' | 'iconsLabels' | 'fullLabels'
type ShadowStyle = 'none' | 'soft' | 'medium' | 'hard' | 'glow'
type SurfaceStyle = 'flat' | 'subtleGradient' | 'glassmorphism' | 'bordered'
type TextureStyle = 'none' | 'noise' | 'dots' | 'lines' | 'mesh'
type SidebarStyle = 'solid' | 'frosted' | 'transparent'
type ButtonStyle = 'solid' | 'outline' | 'ghost' | 'gradient'
type Tone = 'concise' | 'friendly' | 'executive'

type DesignSystem = {
  palette: Record<PaletteKey, string>
  opacity: Record<PaletteKey, number>
  background: {
    mode: GradientMode
    stopA: string
    stopB: string
    meshA: string
    meshB: string
    meshC: string
  }
  typography: {
    headingFont: FontChoice
    bodyFont: FontChoice
    monoFont: FontChoice
    baseSize: number
    lineHeight: number
    letterSpacing: number
    weights: {
      heading: number
      body: number
      labels: number
    }
  }
  layout: {
    sidebarSide: 'left' | 'right'
    sidebarWidth: number
    contentMaxWidth: number
    density: Density
    navStyle: NavStyle
  }
  radius: {
    global: number
    cards: number
    buttons: number
    inputs: number
    badges: number
    modals: number
    preset: 'square' | 'soft' | 'rounded' | 'pill'
  }
  effects: {
    cardShadow: ShadowStyle
    cardSurface: SurfaceStyle
    texture: TextureStyle
    sidebarStyle: SidebarStyle
  }
  components: {
    button: {
      style: ButtonStyle
      height: number
      radius: number
      weight: number
    }
    input: {
      height: number
      borderWidth: number
      focusRing: string
      placeholderOpacity: number
    }
    badge: {
      radius: number
      paddingDensity: Density
    }
    iconSize: 'small' | 'medium' | 'large'
  }
  brand: {
    name: string
    logoDataUrl: string | null
    logoSize: number
    logoRadius: number
    faviconColor: string
    voiceTone: Tone
  }
  recentColors: string[]
}

type HistoryState = {
  past: DesignSystem[]
  present: DesignSystem
  future: DesignSystem[]
}

type HistoryAction =
  | { type: 'set'; next: DesignSystem }
  | { type: 'reset'; next: DesignSystem }
  | { type: 'undo' }
  | { type: 'redo' }

type StudioProps = {
  initialDesign: UserDashboardDesignSettings
  onSaved?: (design: UserDashboardDesignSettings) => void
}

const PALETTE_META: Array<{ key: PaletteKey; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'card', label: 'Card' },
  { key: 'border', label: 'Border' },
  { key: 'textMain', label: 'Text Main' },
  { key: 'textMuted', label: 'Text Muted' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'danger', label: 'Danger' },
  { key: 'info', label: 'Info' },
]

const FONT_OPTIONS: FontChoice[] = [
  'Geist',
  'Instrument Sans',
  'DM Sans',
  'Manrope',
  'Space Grotesk',
  'Inter',
  'JetBrains Mono',
  'IBM Plex Mono',
]

const WEIGHTS = [300, 400, 500, 600, 700]

const PRESETS: Array<{ label: string; value: DesignSystem }> = [
  {
    label: 'Dark Pro',
    value: makeDesignSystem(DEFAULT_DASHBOARD_DESIGN_CONFIG, {
      primary: '#14b8a6',
      accent: '#f59e0b',
      background: '#070b13',
      surface: '#0d1422',
      card: '#111a2b',
      border: '#243044',
      textMain: '#f8fafc',
      textMuted: '#93a4b8',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#38bdf8',
    }),
  },
  {
    label: 'Light Clean',
    value: makeDesignSystem(DEFAULT_DASHBOARD_DESIGN_CONFIG, {
      primary: '#0f766e',
      accent: '#2563eb',
      background: '#f8fafc',
      surface: '#eef4f7',
      card: '#ffffff',
      border: '#dce5eb',
      textMain: '#111827',
      textMuted: '#64748b',
      success: '#059669',
      warning: '#d97706',
      danger: '#dc2626',
      info: '#0284c7',
    }),
  },
  {
    label: 'Warm Studio',
    value: makeDesignSystem(DEFAULT_DASHBOARD_DESIGN_CONFIG, {
      primary: '#b45309',
      accent: '#0f766e',
      background: '#fbf7ef',
      surface: '#f1e8d9',
      card: '#fffdf8',
      border: '#e6d7c3',
      textMain: '#231f1b',
      textMuted: '#776b5e',
      success: '#15803d',
      warning: '#c2410c',
      danger: '#b91c1c',
      info: '#0e7490',
    }),
  },
  {
    label: 'Ocean',
    value: makeDesignSystem(DEFAULT_DASHBOARD_DESIGN_CONFIG, {
      primary: '#0284c7',
      accent: '#10b981',
      background: '#eef9fb',
      surface: '#dff3f6',
      card: '#ffffff',
      border: '#b9dbe4',
      textMain: '#0f2430',
      textMuted: '#54717c',
      success: '#059669',
      warning: '#ca8a04',
      danger: '#e11d48',
      info: '#0891b2',
    }),
  },
  {
    label: 'Midnight',
    value: makeDesignSystem(DEFAULT_DASHBOARD_DESIGN_CONFIG, {
      primary: '#38bdf8',
      accent: '#a3e635',
      background: '#020617',
      surface: '#0f172a',
      card: '#111c31',
      border: '#27364f',
      textMain: '#f8fafc',
      textMuted: '#aab6c8',
      success: '#4ade80',
      warning: '#facc15',
      danger: '#fb7185',
      info: '#67e8f9',
    }),
  },
]

const STUDIO_CSS = `
.pdds {
  --pdds-bg: #070b13;
  --pdds-panel: rgba(14, 21, 33, 0.78);
  --pdds-panel-strong: rgba(16, 25, 39, 0.92);
  --pdds-hairline: rgba(148, 163, 184, 0.18);
  --pdds-copy: #f8fafc;
  --pdds-muted: #9fb0c4;
  --pdds-soft: rgba(148, 163, 184, 0.1);
  --pdds-shadow: 0 22px 70px rgba(0, 0, 0, 0.26);
  --pdds-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --pdds-radius: 8px;
  --pdds-card-radius: 8px;
  --pdds-button-radius: 8px;
  --pdds-input-radius: 8px;
  --pdds-badge-radius: 999px;
  --pdds-modal-radius: 12px;
  --pdds-font-heading: 'Geist', ui-sans-serif, system-ui, sans-serif;
  --pdds-font-body: 'Instrument Sans', ui-sans-serif, system-ui, sans-serif;
  --pdds-font-mono: 'JetBrains Mono', ui-monospace, monospace;
  color: var(--pdds-copy);
  font-family: var(--pdds-font-body);
  letter-spacing: 0;
}
.pdds[data-tone='light'] {
  --pdds-bg: #f6f8fb;
  --pdds-panel: rgba(255, 255, 255, 0.78);
  --pdds-panel-strong: rgba(255, 255, 255, 0.92);
  --pdds-hairline: rgba(15, 23, 42, 0.12);
  --pdds-copy: #101827;
  --pdds-muted: #64748b;
  --pdds-soft: rgba(15, 23, 42, 0.06);
  --pdds-shadow: 0 22px 70px rgba(15, 23, 42, 0.1);
}
.pdds * {
  box-sizing: border-box;
}
.pdds button,
.pdds input,
.pdds select {
  font: inherit;
}
.pdds-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.72fr);
  gap: 18px;
  min-height: 740px;
  border: 1px solid var(--pdds-hairline);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--pdds-primary) 14%, transparent), transparent 38%),
    var(--pdds-bg);
  box-shadow: var(--pdds-shadow);
  overflow: hidden;
}
.pdds-controls {
  min-width: 0;
  max-height: calc(100vh - 128px);
  overflow: auto;
  padding: 18px;
}
.pdds-preview-column {
  min-width: 0;
  border-left: 1px solid var(--pdds-hairline);
  background: linear-gradient(180deg, color-mix(in srgb, var(--pdds-panel-strong) 80%, transparent), color-mix(in srgb, var(--pdds-bg) 88%, transparent));
}
.pdds-topbar,
.pdds-section,
.pdds-preview-wrap {
  border: 1px solid var(--pdds-hairline);
  border-radius: 8px;
  background: var(--pdds-panel);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}
.pdds-topbar {
  position: sticky;
  top: 0;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
  padding: 14px;
}
.pdds-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.pdds-title-mark,
.pdds-icon-button,
.pdds-brand-logo,
.pdds-avatar,
.pdds-preview-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.pdds-title-mark {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  color: white;
  background: linear-gradient(135deg, var(--pdds-primary), var(--pdds-accent));
  box-shadow: 0 12px 26px color-mix(in srgb, var(--pdds-primary) 26%, transparent);
}
.pdds-kicker {
  color: var(--pdds-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.pdds-heading {
  margin-top: 2px;
  color: var(--pdds-copy);
  font-family: var(--pdds-font-heading);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}
.pdds-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.pdds-button,
.pdds-icon-button,
.pdds-segment,
.pdds-preset,
.pdds-swatch,
.pdds-density-card,
.pdds-shape-card,
.pdds-weight-button,
.pdds-recent,
.pdds-section-trigger {
  border: 1px solid var(--pdds-hairline);
  color: var(--pdds-copy);
  background: color-mix(in srgb, var(--pdds-panel-strong) 78%, transparent);
  cursor: pointer;
  transition:
    transform 300ms var(--pdds-ease),
    border-color 300ms var(--pdds-ease),
    background 300ms var(--pdds-ease),
    color 300ms var(--pdds-ease),
    box-shadow 300ms var(--pdds-ease);
}
.pdds-button:hover,
.pdds-icon-button:hover,
.pdds-segment:hover,
.pdds-preset:hover,
.pdds-swatch:hover,
.pdds-density-card:hover,
.pdds-shape-card:hover,
.pdds-weight-button:hover,
.pdds-recent:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--pdds-primary) 48%, var(--pdds-hairline));
  box-shadow: 0 12px 26px color-mix(in srgb, var(--pdds-primary) 12%, transparent);
}
.pdds-button:active,
.pdds-icon-button:active,
.pdds-segment:active,
.pdds-preset:active,
.pdds-swatch:active,
.pdds-weight-button:active,
.pdds-recent:active {
  transform: scale(0.98);
}
.pdds-button {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 8px;
  padding: 0 13px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}
.pdds-button-primary {
  border-color: transparent;
  color: white;
  background: linear-gradient(135deg, var(--pdds-primary), var(--pdds-accent));
}
.pdds-button-danger[data-confirm='true'] {
  border-color: color-mix(in srgb, var(--pdds-danger) 58%, transparent);
  color: var(--pdds-danger);
}
.pdds-button-success {
  color: white;
  border-color: transparent;
  background: linear-gradient(135deg, var(--pdds-success), color-mix(in srgb, var(--pdds-success) 74%, var(--pdds-primary)));
}
.pdds-button:disabled,
.pdds-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
  transform: none;
}
.pdds-icon-button {
  width: 38px;
  height: 38px;
  border-radius: 8px;
}
.pdds-sections {
  display: grid;
  gap: 12px;
}
.pdds-section {
  overflow: hidden;
}
.pdds-section-trigger {
  position: sticky;
  top: 82px;
  z-index: 5;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-width: 0 0 1px;
  border-radius: 0;
  padding: 14px 15px;
  background: color-mix(in srgb, var(--pdds-panel-strong) 88%, transparent);
}
.pdds-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-family: var(--pdds-font-heading);
  font-size: 14px;
  font-weight: 700;
}
.pdds-section-icon {
  color: var(--pdds-accent);
}
.pdds-section-chevron {
  color: var(--pdds-muted);
  transition: transform 300ms var(--pdds-ease);
}
.pdds-section[data-open='false'] .pdds-section-chevron {
  transform: rotate(-90deg);
}
.pdds-section-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 300ms var(--pdds-ease);
}
.pdds-section[data-open='false'] .pdds-section-body {
  grid-template-rows: 0fr;
}
.pdds-section-inner {
  min-height: 0;
  overflow: hidden;
}
.pdds-section-content {
  display: grid;
  gap: 16px;
  padding: 15px;
}
.pdds-field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
}
.pdds-field-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 13px;
}
.pdds-label {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.pdds-label-text {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--pdds-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}
.pdds-value {
  color: var(--pdds-copy);
  font-family: var(--pdds-font-mono);
  font-size: 11px;
  font-weight: 700;
}
.pdds-input,
.pdds-select {
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--pdds-hairline);
  border-radius: 8px;
  color: var(--pdds-copy);
  background: color-mix(in srgb, var(--pdds-panel-strong) 72%, transparent);
  outline: none;
  padding: 0 12px;
  transition: border-color 300ms var(--pdds-ease), box-shadow 300ms var(--pdds-ease), background 300ms var(--pdds-ease);
}
.pdds-select {
  appearance: none;
}
.pdds-input:focus,
.pdds-select:focus {
  border-color: var(--pdds-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--pdds-primary) 18%, transparent);
}
.pdds-input::placeholder {
  color: color-mix(in srgb, var(--pdds-muted) 72%, transparent);
}
.pdds-token-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.pdds-swatch {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-height: 58px;
  border-radius: 8px;
  padding: 9px;
  text-align: left;
}
.pdds-swatch-chip,
.pdds-recent {
  background:
    linear-gradient(45deg, rgba(148,163,184,0.22) 25%, transparent 25% 75%, rgba(148,163,184,0.22) 75%),
    linear-gradient(45deg, rgba(148,163,184,0.22) 25%, transparent 25% 75%, rgba(148,163,184,0.22) 75%);
  background-position: 0 0, 5px 5px;
  background-size: 10px 10px;
}
.pdds-swatch-chip {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
}
.pdds-swatch-label {
  color: var(--pdds-copy);
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pdds-swatch-hex {
  margin-top: 3px;
  color: var(--pdds-muted);
  font-family: var(--pdds-font-mono);
  font-size: 10px;
}
.pdds-swatch[data-token='primary'] .pdds-swatch-chip { background: var(--pdds-primary); }
.pdds-swatch[data-token='accent'] .pdds-swatch-chip { background: var(--pdds-accent); }
.pdds-swatch[data-token='background'] .pdds-swatch-chip { background: var(--pdds-background); }
.pdds-swatch[data-token='surface'] .pdds-swatch-chip { background: var(--pdds-surface); }
.pdds-swatch[data-token='card'] .pdds-swatch-chip { background: var(--pdds-card); }
.pdds-swatch[data-token='border'] .pdds-swatch-chip { background: var(--pdds-border); }
.pdds-swatch[data-token='textMain'] .pdds-swatch-chip { background: var(--pdds-text-main); }
.pdds-swatch[data-token='textMuted'] .pdds-swatch-chip { background: var(--pdds-text-muted); }
.pdds-swatch[data-token='success'] .pdds-swatch-chip { background: var(--pdds-success); }
.pdds-swatch[data-token='warning'] .pdds-swatch-chip { background: var(--pdds-warning); }
.pdds-swatch[data-token='danger'] .pdds-swatch-chip { background: var(--pdds-danger); }
.pdds-swatch[data-token='info'] .pdds-swatch-chip { background: var(--pdds-info); }
.pdds-popover {
  display: grid;
  gap: 13px;
  border: 1px solid var(--pdds-hairline);
  border-radius: 8px;
  padding: 13px;
  background: color-mix(in srgb, var(--pdds-panel-strong) 92%, transparent);
  box-shadow: var(--pdds-shadow);
}
.pdds-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.pdds-picker-title {
  font-family: var(--pdds-font-heading);
  font-size: 13px;
  font-weight: 800;
}
.pdds-saturation {
  position: relative;
  height: 156px;
  border: 1px solid var(--pdds-hairline);
  border-radius: 8px;
  background:
    linear-gradient(0deg, #000, transparent),
    linear-gradient(90deg, #fff, hsl(var(--pdds-picker-hue), 92%, 50%));
  overflow: hidden;
}
.pdds-saturation::after {
  content: "";
  position: absolute;
  left: calc(var(--pdds-picker-sat) * 1%);
  top: calc((100 - var(--pdds-picker-light)) * 1%);
  width: 16px;
  height: 16px;
  border: 2px solid white;
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.3);
  transform: translate(-50%, -50%);
}
.pdds-range-row {
  display: grid;
  gap: 8px;
}
.pdds-range {
  width: 100%;
  height: 26px;
  appearance: none;
  background: transparent;
  cursor: pointer;
}
.pdds-range::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--pdds-primary), var(--pdds-accent));
  box-shadow: inset 0 0 0 1px var(--pdds-hairline);
}
.pdds-range::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  margin-top: -6px;
  border: 3px solid var(--pdds-panel-strong);
  border-radius: 999px;
  background: var(--pdds-copy);
  box-shadow: 0 8px 18px rgba(0,0,0,0.18);
  transition: transform 300ms var(--pdds-ease);
}
.pdds-range:active::-webkit-slider-thumb {
  transform: scale(1.12);
}
.pdds-range-hue::-webkit-slider-runnable-track {
  background: linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444);
}
.pdds-range-opacity::-webkit-slider-runnable-track {
  background: linear-gradient(90deg, transparent, var(--pdds-active-color));
}
.pdds-slider-shell {
  position: relative;
  display: grid;
  gap: 6px;
}
.pdds-slider-tooltip {
  justify-self: end;
  border: 1px solid var(--pdds-hairline);
  border-radius: 999px;
  padding: 2px 8px;
  color: var(--pdds-copy);
  background: color-mix(in srgb, var(--pdds-panel-strong) 92%, transparent);
  font-family: var(--pdds-font-mono);
  font-size: 10px;
  font-weight: 800;
}
.pdds-recent-row,
.pdds-preset-row,
.pdds-segmented,
.pdds-weight-grid,
.pdds-shape-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pdds-preset,
.pdds-segment,
.pdds-weight-button {
  min-height: 36px;
  border-radius: 8px;
  padding: 0 11px;
  font-size: 12px;
  font-weight: 800;
}
.pdds-segment[aria-pressed='true'],
.pdds-preset[aria-pressed='true'],
.pdds-weight-button[aria-pressed='true'],
.pdds-shape-card[aria-pressed='true'],
.pdds-density-card[aria-pressed='true'] {
  border-color: color-mix(in srgb, var(--pdds-primary) 58%, transparent);
  background: color-mix(in srgb, var(--pdds-primary) 16%, var(--pdds-panel-strong));
  color: var(--pdds-copy);
}
.pdds-recent {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  padding: 0;
}
.pdds-recent-0 { background: var(--pdds-recent-0); }
.pdds-recent-1 { background: var(--pdds-recent-1); }
.pdds-recent-2 { background: var(--pdds-recent-2); }
.pdds-recent-3 { background: var(--pdds-recent-3); }
.pdds-recent-4 { background: var(--pdds-recent-4); }
.pdds-recent-5 { background: var(--pdds-recent-5); }
.pdds-gradient-grid,
.pdds-density-grid,
.pdds-effect-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.pdds-gradient-card,
.pdds-density-card,
.pdds-shape-card,
.pdds-effect-card {
  min-height: 76px;
  border-radius: 8px;
  padding: 10px;
}
.pdds-gradient-card {
  border: 1px solid var(--pdds-hairline);
  background: var(--pdds-preview-bg);
}
.pdds-gradient-card[data-mode='solid'] { background: var(--pdds-background); }
.pdds-gradient-card[data-mode='twoStop'] { background: linear-gradient(135deg, var(--pdds-bg-stop-a), var(--pdds-bg-stop-b)); }
.pdds-gradient-card[data-mode='mesh'] {
  background:
    radial-gradient(circle at 20% 20%, var(--pdds-mesh-a), transparent 38%),
    radial-gradient(circle at 80% 24%, var(--pdds-mesh-b), transparent 34%),
    radial-gradient(circle at 50% 82%, var(--pdds-mesh-c), transparent 40%),
    var(--pdds-background);
}
.pdds-gradient-label,
.pdds-density-name,
.pdds-effect-name,
.pdds-shape-name {
  color: var(--pdds-copy);
  font-size: 12px;
  font-weight: 800;
}
.pdds-density-card,
.pdds-shape-card,
.pdds-effect-card {
  display: grid;
  gap: 8px;
  border: 1px solid var(--pdds-hairline);
  background: color-mix(in srgb, var(--pdds-panel-strong) 72%, transparent);
}
.pdds-density-lines {
  display: grid;
  gap: var(--density-gap, 5px);
}
.pdds-density-lines span,
.pdds-chart-bar,
.pdds-table-cell,
.pdds-scale-line {
  border-radius: 999px;
  background: color-mix(in srgb, var(--pdds-muted) 30%, transparent);
}
.pdds-density-lines span {
  height: var(--density-height, 6px);
}
.pdds-density-card[data-density='compact'] { --density-gap: 3px; --density-height: 4px; }
.pdds-density-card[data-density='comfortable'] { --density-gap: 5px; --density-height: 6px; }
.pdds-density-card[data-density='spacious'] { --density-gap: 8px; --density-height: 8px; }
.pdds-shape-preview {
  width: 100%;
  height: 38px;
  border: 1px solid color-mix(in srgb, var(--pdds-primary) 36%, transparent);
  background: linear-gradient(135deg, color-mix(in srgb, var(--pdds-primary) 22%, transparent), color-mix(in srgb, var(--pdds-accent) 15%, transparent));
}
.pdds-shape-card[data-shape='square'] .pdds-shape-preview { border-radius: 0; }
.pdds-shape-card[data-shape='soft'] .pdds-shape-preview { border-radius: 8px; }
.pdds-shape-card[data-shape='rounded'] .pdds-shape-preview { border-radius: 16px; }
.pdds-shape-card[data-shape='pill'] .pdds-shape-preview { border-radius: 999px; }
.pdds-font-card,
.pdds-scale-preview,
.pdds-upload-box {
  border: 1px solid var(--pdds-hairline);
  border-radius: 8px;
  background: color-mix(in srgb, var(--pdds-panel-strong) 72%, transparent);
  padding: 12px;
}
.pdds-font-card {
  display: grid;
  gap: 8px;
}
.pdds-font-preview {
  color: var(--pdds-copy);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
}
.pdds-font-preview-heading { font-family: var(--pdds-font-heading); }
.pdds-font-preview-body { font-family: var(--pdds-font-body); }
.pdds-font-preview-mono { font-family: var(--pdds-font-mono); }
.pdds-scale-preview {
  display: grid;
  gap: 10px;
}
.pdds-scale-h1 { font-family: var(--pdds-font-heading); font-size: calc(var(--pdds-base-size) * 2.1); font-weight: var(--pdds-heading-weight); line-height: var(--pdds-line-height); }
.pdds-scale-h2 { font-family: var(--pdds-font-heading); font-size: calc(var(--pdds-base-size) * 1.55); font-weight: var(--pdds-heading-weight); line-height: var(--pdds-line-height); }
.pdds-scale-h3 { font-family: var(--pdds-font-heading); font-size: calc(var(--pdds-base-size) * 1.2); font-weight: var(--pdds-heading-weight); line-height: var(--pdds-line-height); }
.pdds-scale-body { font-size: var(--pdds-base-size); font-weight: var(--pdds-body-weight); line-height: var(--pdds-line-height); }
.pdds-scale-caption { color: var(--pdds-muted); font-size: calc(var(--pdds-base-size) * .78); font-weight: var(--pdds-label-weight); line-height: var(--pdds-line-height); }
.pdds-upload-box {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}
.pdds-upload-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
.pdds-upload-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--pdds-accent);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}
.pdds-brand-logo {
  width: var(--pdds-logo-size);
  height: var(--pdds-logo-size);
  border: 1px solid var(--pdds-hairline);
  border-radius: var(--pdds-logo-radius);
  background: linear-gradient(135deg, var(--pdds-primary), var(--pdds-accent));
  color: white;
  font-weight: 900;
  overflow: hidden;
}
.pdds-brand-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pdds-preview-wrap {
  position: sticky;
  top: 84px;
  display: grid;
  gap: 14px;
  margin: 18px;
  padding: 14px;
}
.pdds-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.pdds-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--pdds-success) 38%, transparent);
  border-radius: 999px;
  padding: 5px 9px;
  color: var(--pdds-success);
  background: color-mix(in srgb, var(--pdds-success) 10%, transparent);
  font-size: 11px;
  font-weight: 800;
}
.pdds-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 18%, transparent);
}
.pdds-dashboard {
  min-height: 470px;
  overflow: hidden;
  border: 1px solid var(--pdds-border);
  border-radius: var(--pdds-modal-radius);
  background: var(--pdds-preview-bg);
  color: var(--pdds-text-main);
  font-family: var(--pdds-font-body);
  font-size: var(--pdds-base-size);
  letter-spacing: var(--pdds-letter-spacing);
  box-shadow: var(--pdds-preview-shadow);
  transition: all 300ms var(--pdds-ease);
}
.pdds-dashboard[data-sidebar='right'] .pdds-mini-shell {
  grid-template-columns: minmax(0, 1fr) minmax(74px, calc(var(--pdds-sidebar-width) * .38));
}
.pdds-dashboard[data-sidebar='right'] .pdds-mini-sidebar {
  order: 2;
  border-right: 0;
  border-left: 1px solid var(--pdds-border);
}
.pdds-mini-shell {
  display: grid;
  grid-template-columns: minmax(74px, calc(var(--pdds-sidebar-width) * .38)) minmax(0, 1fr);
  min-height: 470px;
  transition: grid-template-columns 300ms var(--pdds-ease);
}
.pdds-mini-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-right: 1px solid var(--pdds-border);
  padding: var(--pdds-density-pad);
  background: var(--pdds-preview-sidebar-bg);
  backdrop-filter: var(--pdds-sidebar-blur);
  -webkit-backdrop-filter: var(--pdds-sidebar-blur);
  transition: all 300ms var(--pdds-ease);
}
.pdds-preview-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  margin-bottom: 8px;
}
.pdds-preview-brand-name {
  overflow: hidden;
  color: var(--pdds-text-main);
  font-family: var(--pdds-font-heading);
  font-size: 13px;
  font-weight: var(--pdds-heading-weight);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pdds-preview-nav {
  display: grid;
  gap: 7px;
}
.pdds-preview-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: var(--pdds-nav-height);
  border: 1px solid transparent;
  border-radius: var(--pdds-radius);
  padding: 0 9px;
  color: var(--pdds-text-muted);
  transition: all 300ms var(--pdds-ease);
}
.pdds-preview-nav-item[data-active='true'] {
  border-color: color-mix(in srgb, var(--pdds-primary) 36%, transparent);
  color: var(--pdds-text-main);
  background: color-mix(in srgb, var(--pdds-primary) 15%, transparent);
}
.pdds-preview-nav-label {
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  font-weight: var(--pdds-label-weight);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pdds-dashboard[data-nav='icons'] .pdds-preview-brand-name,
.pdds-dashboard[data-nav='icons'] .pdds-preview-nav-label {
  display: none;
}
.pdds-dashboard[data-nav='icons'] .pdds-preview-nav-item,
.pdds-dashboard[data-nav='icons'] .pdds-preview-brand {
  justify-content: center;
}
.pdds-dashboard[data-nav='icons'] .pdds-mini-shell {
  grid-template-columns: 76px minmax(0, 1fr);
}
.pdds-dashboard[data-nav='fullLabels'] .pdds-mini-shell {
  grid-template-columns: minmax(118px, calc(var(--pdds-sidebar-width) * .5)) minmax(0, 1fr);
}
.pdds-mini-main {
  min-width: 0;
  padding: var(--pdds-density-pad);
}
.pdds-mini-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: var(--pdds-density-pad);
}
.pdds-search {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 7px;
  min-height: var(--pdds-input-height);
  border: var(--pdds-input-border) solid var(--pdds-border);
  border-radius: var(--pdds-input-radius);
  padding: 0 10px;
  color: color-mix(in srgb, var(--pdds-text-muted) calc(var(--pdds-placeholder-opacity) * 100%), transparent);
  background: color-mix(in srgb, var(--pdds-card) 78%, transparent);
}
.pdds-avatar {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  color: white;
  background: linear-gradient(135deg, var(--pdds-primary), var(--pdds-accent));
  font-size: 12px;
  font-weight: 900;
}
.pdds-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--pdds-density-gap);
  margin-bottom: var(--pdds-density-pad);
}
.pdds-stat-card,
.pdds-chart-card,
.pdds-table {
  border: var(--pdds-card-border-width) solid var(--pdds-border);
  border-radius: var(--pdds-card-radius);
  background: var(--pdds-card-surface);
  box-shadow: var(--pdds-preview-shadow);
  transition: all 300ms var(--pdds-ease);
}
.pdds-stat-card {
  display: grid;
  gap: 7px;
  min-height: var(--pdds-stat-height);
  padding: var(--pdds-card-pad);
}
.pdds-stat-label {
  color: var(--pdds-text-muted);
  font-size: 10px;
  font-weight: var(--pdds-label-weight);
}
.pdds-stat-value {
  color: var(--pdds-text-main);
  font-family: var(--pdds-font-heading);
  font-size: 20px;
  font-weight: var(--pdds-heading-weight);
  line-height: 1;
}
.pdds-stat-delta,
.pdds-preview-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border-radius: var(--pdds-badge-radius);
  color: var(--pdds-success);
  background: color-mix(in srgb, var(--pdds-success) 13%, transparent);
  font-size: 10px;
  font-weight: var(--pdds-label-weight);
}
.pdds-stat-delta {
  padding: 2px 7px;
}
.pdds-work-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(118px, .55fr);
  gap: var(--pdds-density-gap);
}
.pdds-chart-card,
.pdds-table {
  padding: var(--pdds-card-pad);
}
.pdds-chart-card {
  min-height: 160px;
}
.pdds-chart-title,
.pdds-table-title {
  margin-bottom: 14px;
  color: var(--pdds-text-main);
  font-size: 12px;
  font-weight: var(--pdds-heading-weight);
}
.pdds-chart-area {
  display: flex;
  align-items: end;
  gap: 8px;
  min-height: 96px;
}
.pdds-chart-bar {
  flex: 1;
  min-width: 0;
  background: linear-gradient(180deg, var(--pdds-primary), color-mix(in srgb, var(--pdds-accent) 70%, transparent));
}
.pdds-chart-bar:nth-child(1) { height: 42%; }
.pdds-chart-bar:nth-child(2) { height: 74%; }
.pdds-chart-bar:nth-child(3) { height: 58%; }
.pdds-chart-bar:nth-child(4) { height: 92%; }
.pdds-chart-bar:nth-child(5) { height: 64%; }
.pdds-table-row {
  display: grid;
  grid-template-columns: 1.2fr .7fr .5fr;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  border-top: 1px solid var(--pdds-border);
}
.pdds-table-cell {
  height: 9px;
  background: color-mix(in srgb, var(--pdds-text-muted) 30%, transparent);
}
.pdds-preview-badge {
  padding: var(--pdds-badge-padding);
  color: var(--pdds-info);
  background: color-mix(in srgb, var(--pdds-info) 13%, transparent);
}
.pdds-toast {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 80;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  max-width: min(420px, calc(100vw - 36px));
  border: 1px solid var(--pdds-hairline);
  border-radius: 8px;
  padding: 12px 14px;
  color: var(--pdds-copy);
  background: var(--pdds-panel-strong);
  box-shadow: var(--pdds-shadow);
  animation: pddsToast 260ms var(--pdds-ease) both;
}
.pdds-shake {
  animation: pddsShake 360ms var(--pdds-ease) both;
}
@keyframes pddsShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  50% { transform: translateX(4px); }
  75% { transform: translateX(-2px); }
}
@keyframes pddsToast {
  from { opacity: 0; transform: translateY(10px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (max-width: 1180px) {
  .pdds-shell {
    grid-template-columns: 1fr;
  }
  .pdds-preview-column {
    border-left: 0;
    border-top: 1px solid var(--pdds-hairline);
  }
  .pdds-preview-wrap {
    position: relative;
    top: auto;
  }
  .pdds-controls {
    max-height: none;
  }
}
@media (max-width: 700px) {
  .pdds-shell {
    border-radius: 0;
    margin-inline: -20px;
  }
  .pdds-controls,
  .pdds-preview-wrap {
    padding: 12px;
    margin: 0;
  }
  .pdds-topbar,
  .pdds-preview-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .pdds-actions,
  .pdds-actions > * {
    width: 100%;
  }
  .pdds-button,
  .pdds-icon-button {
    flex: 1 1 auto;
  }
  .pdds-field-grid,
  .pdds-field-grid-3,
  .pdds-token-grid,
  .pdds-gradient-grid,
  .pdds-density-grid,
  .pdds-effect-grid,
  .pdds-stat-grid,
  .pdds-work-grid {
    grid-template-columns: 1fr;
  }
  .pdds-dashboard[data-nav='icons'] .pdds-mini-shell,
  .pdds-dashboard[data-nav='fullLabels'] .pdds-mini-shell,
  .pdds-mini-shell,
  .pdds-dashboard[data-sidebar='right'] .pdds-mini-shell {
    grid-template-columns: 74px minmax(0, 1fr);
  }
  .pdds-dashboard[data-sidebar='right'] .pdds-mini-sidebar {
    order: 0;
    border-left: 0;
    border-right: 1px solid var(--pdds-border);
  }
}
@media (max-width: 420px) {
  .pdds-token-grid {
    gap: 8px;
  }
  .pdds-swatch {
    grid-template-columns: 28px minmax(0, 1fr);
    min-height: 52px;
  }
  .pdds-swatch-chip {
    width: 28px;
    height: 28px;
  }
}
`

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  if (action.type === 'undo') {
    const previous = state.past.at(-1)
    if (!previous) return state
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future].slice(0, 80),
    }
  }

  if (action.type === 'redo') {
    const next = state.future[0]
    if (!next) return state
    return {
      past: [...state.past, state.present].slice(-80),
      present: next,
      future: state.future.slice(1),
    }
  }

  if (action.type === 'reset') {
    return {
      past: [...state.past, state.present].slice(-80),
      present: action.next,
      future: [],
    }
  }

  return {
    past: [...state.past, state.present].slice(-80),
    present: action.next,
    future: [],
  }
}

function makeDesignSystem(core: DashboardDesignConfig, paletteOverride?: Record<PaletteKey, string>): DesignSystem {
  const palette: Record<PaletteKey, string> = paletteOverride ?? {
    primary: core.palette.primary,
    accent: core.palette.accent,
    background: core.palette.background,
    surface: core.palette.elevated,
    card: core.palette.card,
    border: core.palette.border,
    textMain: core.palette.text,
    textMuted: core.palette.textMuted,
    success: core.palette.success,
    warning: core.palette.warning,
    danger: core.palette.danger,
    info: core.palette.info,
  }

  return {
    palette,
    opacity: {
      primary: 1,
      accent: 1,
      background: 1,
      surface: 1,
      card: 1,
      border: 1,
      textMain: 1,
      textMuted: 1,
      success: 1,
      warning: 1,
      danger: 1,
      info: 1,
    },
    background: {
      mode: core.background.style === 'gradient' ? 'twoStop' : 'solid',
      stopA: core.background.gradientFrom,
      stopB: core.background.gradientTo,
      meshA: palette.primary,
      meshB: palette.accent,
      meshC: palette.info,
    },
    typography: {
      headingFont: 'Geist',
      bodyFont: 'Instrument Sans',
      monoFont: 'JetBrains Mono',
      baseSize: core.typography.baseSize,
      lineHeight: 1.55,
      letterSpacing: 0,
      weights: {
        heading: core.typography.headingWeight,
        body: core.typography.bodyWeight,
        labels: 600,
      },
    },
    layout: {
      sidebarSide: core.layout.sidebarSide,
      sidebarWidth: core.layout.sidebarWidth,
      contentMaxWidth: core.layout.contentWidth,
      density: core.layout.density,
      navStyle: 'iconsLabels',
    },
    radius: {
      global: core.layout.navRadius,
      cards: core.layout.cardRadius,
      buttons: core.buttons.radius,
      inputs: core.buttons.radius,
      badges: 999,
      modals: Math.min(24, core.layout.cardRadius + 6),
      preset: 'soft',
    },
    effects: {
      cardShadow: core.cards.shadow === 'strong' ? 'hard' : core.cards.shadow,
      cardSurface: 'glassmorphism',
      texture: 'noise',
      sidebarStyle: 'frosted',
    },
    components: {
      button: {
        style: core.buttons.style === 'minimal' ? 'ghost' : core.buttons.style === 'soft' ? 'solid' : core.buttons.style,
        height: core.buttons.height,
        radius: core.buttons.radius,
        weight: core.buttons.fontWeight,
      },
      input: {
        height: 42,
        borderWidth: 1,
        focusRing: palette.primary,
        placeholderOpacity: 0.68,
      },
      badge: {
        radius: 999,
        paddingDensity: core.layout.density,
      },
      iconSize: 'medium',
    },
    brand: {
      name: core.brand.name,
      logoDataUrl: core.brand.logoDataUrl,
      logoSize: core.brand.logoSize,
      logoRadius: core.brand.logoRadius,
      faviconColor: palette.primary,
      voiceTone: 'concise',
    },
    recentColors: [palette.primary, palette.accent, palette.info, palette.success, palette.warning, palette.danger],
  }
}

function fontStack(font: FontChoice) {
  return `'${font}', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
}

function monoFontStack(font: FontChoice) {
  return `'${font}', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value)
}

function hexToRgb(hex: string) {
  const normalized = isHexColor(hex) ? hex.slice(1) : '000000'
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function hexToRgba(hex: string, opacity = 1) {
  const rgb = hexToRgb(hex)
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(opacity, 0, 1)})`
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const channels = [r, g, b].map((channel) => {
    const next = channel / 255
    return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function hslToHex(h: number, s: number, l: number) {
  const hue = h / 360
  const saturation = s / 100
  const lightness = l / 100
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q
  const toRgb = (offset: number) => {
    let t = hue + offset
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const channels = [toRgb(1 / 3), toRgb(0), toRgb(-1 / 3)].map((value) =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, '0')
  )
  return `#${channels.join('')}`
}

function hexToHsl(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: lightness * 100 }

  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  const hue =
    max === red
      ? (green - blue) / delta + (green < blue ? 6 : 0)
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4

  return { h: Math.round((hue / 6) * 360), s: Math.round(saturation * 100), l: Math.round(lightness * 100) }
}

function withRecentColors(designSystem: DesignSystem, color: string) {
  if (!isHexColor(color)) return designSystem
  return {
    ...designSystem,
    recentColors: [color, ...designSystem.recentColors.filter((item) => item.toLowerCase() !== color.toLowerCase())].slice(0, 6),
  }
}

function toCoreDesign(designSystem: DesignSystem): DashboardDesignConfig {
  return {
    version: 1,
    brand: {
      name: designSystem.brand.name.slice(0, 42) || 'TASKIT',
      logoDataUrl: designSystem.brand.logoDataUrl,
      logoSize: designSystem.brand.logoSize,
      logoRadius: designSystem.brand.logoRadius,
    },
    palette: {
      primary: designSystem.palette.primary,
      accent: designSystem.palette.accent,
      background: designSystem.palette.background,
      backgroundSoft: designSystem.palette.surface,
      card: designSystem.palette.card,
      elevated: designSystem.palette.surface,
      sidebar: designSystem.effects.sidebarStyle === 'transparent' ? designSystem.palette.background : designSystem.palette.surface,
      sidebarSurface: designSystem.palette.card,
      border: designSystem.palette.border,
      text: designSystem.palette.textMain,
      textSecondary: designSystem.palette.textMuted,
      textMuted: designSystem.palette.textMuted,
      success: designSystem.palette.success,
      warning: designSystem.palette.warning,
      danger: designSystem.palette.danger,
      info: designSystem.palette.info,
    },
    background: {
      style: designSystem.background.mode === 'solid' ? 'solid' : 'gradient',
      gradientFrom: designSystem.background.mode === 'mesh' ? designSystem.background.meshA : designSystem.background.stopA,
      gradientTo: designSystem.background.mode === 'mesh' ? designSystem.background.meshB : designSystem.background.stopB,
      imageUrl: null,
      imagePublicId: null,
      imageOverlayColor: '#000000',
      imageOverlayOpacity: 18,
    },
    typography: {
      fontFamily: fontStack(designSystem.typography.bodyFont),
      baseSize: designSystem.typography.baseSize,
      headingWeight: designSystem.typography.weights.heading,
      bodyWeight: designSystem.typography.weights.body,
    },
    layout: {
      sidebarWidth: designSystem.layout.sidebarWidth,
      sidebarSide: designSystem.layout.sidebarSide,
      contentWidth: designSystem.layout.contentMaxWidth,
      density: designSystem.layout.density,
      navRadius: designSystem.radius.global,
      cardRadius: designSystem.radius.cards,
    },
    buttons: {
      style:
        designSystem.components.button.style === 'ghost'
          ? 'minimal'
          : designSystem.components.button.style === 'gradient'
            ? 'solid'
            : designSystem.components.button.style,
      radius: designSystem.components.button.radius,
      height: designSystem.components.button.height,
      fontWeight: designSystem.components.button.weight,
    },
    cards: {
      shadow:
        designSystem.effects.cardShadow === 'hard' || designSystem.effects.cardShadow === 'glow'
          ? 'strong'
          : designSystem.effects.cardShadow === 'none'
            ? 'none'
            : 'soft',
      borderWidth: designSystem.effects.cardSurface === 'bordered' ? 2 : 1,
    },
  }
}

function exportTokens(designSystem: DesignSystem) {
  const lines = [
    ':root {',
    ...PALETTE_META.map(({ key }) => `  --color-${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}: ${hexToRgba(designSystem.palette[key], designSystem.opacity[key])};`),
    `  --font-heading: ${fontStack(designSystem.typography.headingFont)};`,
    `  --font-body: ${fontStack(designSystem.typography.bodyFont)};`,
    `  --font-mono: ${monoFontStack(designSystem.typography.monoFont)};`,
    `  --font-base-size: ${designSystem.typography.baseSize}px;`,
    `  --line-height: ${designSystem.typography.lineHeight};`,
    `  --letter-spacing: ${designSystem.typography.letterSpacing}px;`,
    `  --sidebar-width: ${designSystem.layout.sidebarWidth}px;`,
    `  --content-max-width: ${designSystem.layout.contentMaxWidth}px;`,
    `  --radius-global: ${designSystem.radius.global}px;`,
    `  --radius-card: ${designSystem.radius.cards}px;`,
    `  --radius-button: ${designSystem.radius.buttons}px;`,
    `  --button-height: ${designSystem.components.button.height}px;`,
    '}',
  ]

  return lines.join('\n')
}

function setVars(element: HTMLElement, designSystem: DesignSystem) {
  const root = document.documentElement
  const targets = [root, element]
  const densityPad = designSystem.layout.density === 'compact' ? '12px' : designSystem.layout.density === 'spacious' ? '22px' : '16px'
  const densityGap = designSystem.layout.density === 'compact' ? '8px' : designSystem.layout.density === 'spacious' ? '16px' : '12px'
  const cardPad = designSystem.layout.density === 'compact' ? '10px' : designSystem.layout.density === 'spacious' ? '18px' : '14px'
  const navHeight = designSystem.layout.density === 'compact' ? '32px' : designSystem.layout.density === 'spacious' ? '42px' : '36px'
  const statHeight = designSystem.layout.density === 'compact' ? '76px' : designSystem.layout.density === 'spacious' ? '108px' : '92px'
  const iconPx = designSystem.components.iconSize === 'small' ? '14px' : designSystem.components.iconSize === 'large' ? '20px' : '17px'
  const shadow =
    designSystem.effects.cardShadow === 'none'
      ? 'none'
      : designSystem.effects.cardShadow === 'soft'
        ? '0 10px 28px rgba(2, 6, 23, 0.08)'
        : designSystem.effects.cardShadow === 'medium'
          ? '0 18px 38px rgba(2, 6, 23, 0.14)'
          : designSystem.effects.cardShadow === 'glow'
            ? `0 0 38px ${hexToRgba(designSystem.palette.primary, 0.22)}`
            : '0 24px 54px rgba(2, 6, 23, 0.22)'
  const cardSurface =
    designSystem.effects.cardSurface === 'glassmorphism'
      ? `color-mix(in srgb, ${hexToRgba(designSystem.palette.card, 0.82)} 88%, transparent)`
      : designSystem.effects.cardSurface === 'subtleGradient'
        ? `linear-gradient(145deg, ${designSystem.palette.card}, ${hexToRgba(designSystem.palette.primary, 0.08)})`
        : designSystem.effects.cardSurface === 'bordered'
          ? designSystem.palette.card
          : designSystem.palette.card
  const previewBg =
    designSystem.background.mode === 'twoStop'
      ? `linear-gradient(135deg, ${designSystem.background.stopA}, ${designSystem.background.stopB})`
      : designSystem.background.mode === 'mesh'
        ? `radial-gradient(circle at 20% 20%, ${hexToRgba(designSystem.background.meshA, 0.34)}, transparent 34%), radial-gradient(circle at 82% 18%, ${hexToRgba(designSystem.background.meshB, 0.28)}, transparent 32%), radial-gradient(circle at 50% 88%, ${hexToRgba(designSystem.background.meshC, 0.3)}, transparent 40%), ${designSystem.palette.background}`
        : designSystem.palette.background
  const sidebarBg =
    designSystem.effects.sidebarStyle === 'transparent'
      ? 'transparent'
      : designSystem.effects.sidebarStyle === 'frosted'
        ? hexToRgba(designSystem.palette.surface, 0.74)
        : designSystem.palette.surface
  const badgePad =
    designSystem.components.badge.paddingDensity === 'compact'
      ? '2px 6px'
      : designSystem.components.badge.paddingDensity === 'spacious'
        ? '5px 10px'
        : '3px 8px'

  targets.forEach((target) => {
    PALETTE_META.forEach(({ key }) => {
      const varName = key === 'textMain' ? '--pdds-text-main' : key === 'textMuted' ? '--pdds-text-muted' : `--pdds-${key}`
      target.style.setProperty(varName, hexToRgba(designSystem.palette[key], designSystem.opacity[key]))
      root.style.setProperty(`--pdds-root-${key}`, hexToRgba(designSystem.palette[key], designSystem.opacity[key]))
    })
    target.style.setProperty('--pdds-bg-stop-a', designSystem.background.stopA)
    target.style.setProperty('--pdds-bg-stop-b', designSystem.background.stopB)
    target.style.setProperty('--pdds-mesh-a', designSystem.background.meshA)
    target.style.setProperty('--pdds-mesh-b', designSystem.background.meshB)
    target.style.setProperty('--pdds-mesh-c', designSystem.background.meshC)
    target.style.setProperty('--pdds-preview-bg', previewBg)
    target.style.setProperty('--pdds-preview-sidebar-bg', sidebarBg)
    target.style.setProperty('--pdds-sidebar-blur', designSystem.effects.sidebarStyle === 'frosted' ? 'blur(22px)' : 'none')
    target.style.setProperty('--pdds-preview-shadow', shadow)
    target.style.setProperty('--pdds-card-surface', cardSurface)
    target.style.setProperty('--pdds-card-border-width', designSystem.effects.cardSurface === 'bordered' ? '2px' : '1px')
    target.style.setProperty('--pdds-font-heading', fontStack(designSystem.typography.headingFont))
    target.style.setProperty('--pdds-font-body', fontStack(designSystem.typography.bodyFont))
    target.style.setProperty('--pdds-font-mono', monoFontStack(designSystem.typography.monoFont))
    target.style.setProperty('--pdds-base-size', `${designSystem.typography.baseSize}px`)
    target.style.setProperty('--pdds-line-height', String(designSystem.typography.lineHeight))
    target.style.setProperty('--pdds-letter-spacing', `${designSystem.typography.letterSpacing}px`)
    target.style.setProperty('--pdds-heading-weight', String(designSystem.typography.weights.heading))
    target.style.setProperty('--pdds-body-weight', String(designSystem.typography.weights.body))
    target.style.setProperty('--pdds-label-weight', String(designSystem.typography.weights.labels))
    target.style.setProperty('--pdds-sidebar-width', `${designSystem.layout.sidebarWidth}px`)
    target.style.setProperty('--pdds-radius', `${designSystem.radius.global}px`)
    target.style.setProperty('--pdds-card-radius', `${designSystem.radius.cards}px`)
    target.style.setProperty('--pdds-button-radius', `${designSystem.components.button.radius}px`)
    target.style.setProperty('--pdds-input-radius', `${designSystem.radius.inputs}px`)
    target.style.setProperty('--pdds-badge-radius', `${designSystem.components.badge.radius}px`)
    target.style.setProperty('--pdds-modal-radius', `${designSystem.radius.modals}px`)
    target.style.setProperty('--pdds-logo-size', `${designSystem.brand.logoSize}px`)
    target.style.setProperty('--pdds-logo-radius', `${designSystem.brand.logoRadius}px`)
    target.style.setProperty('--pdds-density-pad', densityPad)
    target.style.setProperty('--pdds-density-gap', densityGap)
    target.style.setProperty('--pdds-card-pad', cardPad)
    target.style.setProperty('--pdds-nav-height', navHeight)
    target.style.setProperty('--pdds-stat-height', statHeight)
    target.style.setProperty('--pdds-icon-size', iconPx)
    target.style.setProperty('--pdds-input-height', `${designSystem.components.input.height}px`)
    target.style.setProperty('--pdds-input-border', `${designSystem.components.input.borderWidth}px`)
    target.style.setProperty('--pdds-focus-ring', designSystem.components.input.focusRing)
    target.style.setProperty('--pdds-placeholder-opacity', String(designSystem.components.input.placeholderOpacity))
    target.style.setProperty('--pdds-badge-padding', badgePad)
    designSystem.recentColors.forEach((color, index) => target.style.setProperty(`--pdds-recent-${index}`, color))
  })
}

function updateObject<T>(value: T, mutator: (draft: T) => void): T {
  const next = structuredClone(value)
  mutator(next)
  return next
}

function getSaveError(value: unknown) {
  if (value && typeof value === 'object' && 'error' in value && typeof value.error === 'string') {
    return value.error
  }
  return 'Design could not be saved.'
}

function Section({
  id,
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  icon: typeof Paintbrush
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="pdds-section" data-open={open}>
      <button className="pdds-section-trigger" type="button" onClick={onToggle} aria-expanded={open} aria-controls={id}>
        <span className="pdds-section-title">
          <Icon className="pdds-section-icon" size={17} />
          {title}
        </span>
        <ChevronDown className="pdds-section-chevron" size={17} />
      </button>
      <div className="pdds-section-body" id={id}>
        <div className="pdds-section-inner">
          <div className="pdds-section-content">{children}</div>
        </div>
      </div>
    </section>
  )
}

function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="pdds-label">
      <span className="pdds-label-text">
        {label}
        <span className="pdds-value">
          {value}
          {suffix}
        </span>
      </span>
      <span className="pdds-slider-shell">
        <span className="pdds-slider-tooltip">
          {value}
          {suffix}
        </span>
        <input
          className="pdds-range"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
      </span>
    </label>
  )
}

function FontSelector({
  label,
  value,
  previewClass,
  onChange,
}: {
  label: string
  value: FontChoice
  previewClass: string
  onChange: (value: FontChoice) => void
}) {
  return (
    <label className="pdds-font-card">
      <span className="pdds-label-text">{label}</span>
      <select className="pdds-select" value={value} onChange={(event) => onChange(event.currentTarget.value as FontChoice)}>
        {FONT_OPTIONS.map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>
      <span className={`pdds-font-preview ${previewClass}`}>Aa Bb 123</span>
    </label>
  )
}

function ColorSwatch({
  token,
  label,
  color,
  opacity,
  selected,
  onSelect,
}: {
  token: PaletteKey
  label: string
  color: string
  opacity: number
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button className="pdds-swatch" data-token={token} type="button" aria-pressed={selected} onClick={onSelect}>
      <span className="pdds-swatch-chip" aria-hidden="true" />
      <span>
        <span className="pdds-swatch-label">{label}</span>
        <span className="pdds-swatch-hex">
          {color} / {Math.round(opacity * 100)}%
        </span>
      </span>
    </button>
  )
}

function ColorPicker({
  token,
  label,
  value,
  opacity,
  recentColors,
  onColor,
  onOpacity,
}: {
  token: PaletteKey
  label: string
  value: string
  opacity: number
  recentColors: string[]
  onColor: (value: string) => void
  onOpacity: (value: number) => void
}) {
  const hsl = hexToHsl(value)
  async function pickFromScreen() {
    const WithEyeDropper = window as Window & {
      EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> }
    }
    if (!WithEyeDropper.EyeDropper) return
    const result = await new WithEyeDropper.EyeDropper().open()
    onColor(result.sRGBHex)
  }

  return (
    <div className="pdds-popover">
      <div className="pdds-picker-head">
        <div>
          <div className="pdds-kicker">Editing {token}</div>
          <div className="pdds-picker-title">{label}</div>
        </div>
        <button className="pdds-icon-button" type="button" onClick={() => void pickFromScreen()} aria-label="Use eyedropper" title="Eyedropper">
          <Eye size={16} />
        </button>
      </div>
      <button
        className="pdds-saturation"
        type="button"
        aria-label={`${label} saturation and lightness`}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          const saturation = clamp(((event.clientX - box.left) / box.width) * 100, 0, 100)
          const lightness = clamp(100 - ((event.clientY - box.top) / box.height) * 100, 0, 100)
          onColor(hslToHex(hsl.h, saturation, lightness))
        }}
      />
      <label className="pdds-range-row">
        <span className="pdds-label-text">Hue</span>
        <input
          className="pdds-range pdds-range-hue"
          type="range"
          min={0}
          max={360}
          value={hsl.h}
          onChange={(event) => onColor(hslToHex(Number(event.currentTarget.value), Math.max(55, hsl.s), Math.max(32, hsl.l)))}
        />
      </label>
      <label className="pdds-range-row">
        <span className="pdds-label-text">Opacity</span>
        <input
          className="pdds-range pdds-range-opacity"
          type="range"
          min={0.25}
          max={1}
          step={0.01}
          value={opacity}
          onChange={(event) => onOpacity(Number(event.currentTarget.value))}
        />
      </label>
      <label className="pdds-label">
        <span className="pdds-label-text">Hex</span>
        <input
          className="pdds-input"
          value={value}
          maxLength={7}
          spellCheck={false}
          onChange={(event) => {
            const next = event.currentTarget.value
            if (isHexColor(next)) onColor(next)
          }}
        />
      </label>
      <div className="pdds-recent-row" aria-label="Recent colors">
        {recentColors.map((recent, index) => (
          <button
            key={`${recent}-${index}`}
            className={`pdds-recent pdds-recent-${index}`}
            type="button"
            aria-label={`Use ${recent}`}
            onClick={() => onColor(recent)}
          />
        ))}
      </div>
    </div>
  )
}

function PreviewDashboard({ designSystem }: { designSystem: DesignSystem }) {
  const navItems = ['Home', 'Work', 'Signals', 'Team']
  const voiceCopy =
    designSystem.brand.voiceTone === 'executive'
      ? 'Executive pulse'
      : designSystem.brand.voiceTone === 'friendly'
        ? 'Today looks good'
        : 'Command view'

  return (
    <div className="pdds-preview-wrap">
      <div className="pdds-preview-head">
        <div>
          <div className="pdds-kicker">Live preview</div>
          <div className="pdds-heading">Dashboard surface</div>
        </div>
        <span className="pdds-live-pill">
          <span className="pdds-live-dot" />
          Live
        </span>
      </div>
      <div className="pdds-dashboard" data-sidebar={designSystem.layout.sidebarSide} data-nav={designSystem.layout.navStyle}>
        <div className="pdds-mini-shell">
          <aside className="pdds-mini-sidebar">
            <div className="pdds-preview-brand">
              <div className="pdds-brand-logo">
                {designSystem.brand.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={designSystem.brand.logoDataUrl} alt="" />
                ) : (
                  designSystem.brand.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="pdds-preview-brand-name">{designSystem.brand.name}</div>
            </div>
            <nav className="pdds-preview-nav" aria-label="Preview navigation">
              {navItems.map((item, index) => (
                <div key={item} className="pdds-preview-nav-item" data-active={index === 0}>
                  <Box size={16} />
                  <span className="pdds-preview-nav-label">{item}</span>
                </div>
              ))}
            </nav>
          </aside>
          <main className="pdds-mini-main">
            <header className="pdds-mini-header">
              <div className="pdds-search">
                <Search size={15} />
                <span>{voiceCopy}</span>
              </div>
              <div className="pdds-avatar">DH</div>
            </header>
            <div className="pdds-stat-grid">
              {[
                ['Revenue', '$42.8k', '+12%'],
                ['Tasks', '128', '+8'],
                ['Health', '96%', 'On'],
              ].map(([label, value, delta]) => (
                <article className="pdds-stat-card" key={label}>
                  <span className="pdds-stat-label">{label}</span>
                  <strong className="pdds-stat-value">{value}</strong>
                  <span className="pdds-stat-delta">{delta}</span>
                </article>
              ))}
            </div>
            <div className="pdds-work-grid">
              <section className="pdds-chart-card">
                <div className="pdds-chart-title">Performance</div>
                <div className="pdds-chart-area">
                  <span className="pdds-chart-bar" />
                  <span className="pdds-chart-bar" />
                  <span className="pdds-chart-bar" />
                  <span className="pdds-chart-bar" />
                  <span className="pdds-chart-bar" />
                </div>
              </section>
              <section className="pdds-table">
                <div className="pdds-table-title">Queue</div>
                <div className="pdds-table-row">
                  <span className="pdds-table-cell" />
                  <span className="pdds-table-cell" />
                  <span className="pdds-preview-badge">Ready</span>
                </div>
                <div className="pdds-table-row">
                  <span className="pdds-table-cell" />
                  <span className="pdds-table-cell" />
                  <span className="pdds-preview-badge">Live</span>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function PremiumDashboardDesignStudio({ initialDesign, onSaved }: StudioProps) {
  const initialCore = useMemo(() => normalizeDashboardDesignConfig(initialDesign.designJson), [initialDesign.designJson])
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: makeDesignSystem(initialCore),
    future: [],
  })
  const designSystem = history.present
  const studioRef = useRef<HTMLDivElement>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    color: true,
    typography: true,
    layout: true,
    radius: true,
    effects: true,
    components: true,
    brand: true,
  })
  const [selectedToken, setSelectedToken] = useState<PaletteKey>('primary')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const tone = luminance(designSystem.palette.background) > 0.52 ? 'light' : 'dark'
  const selectedMeta = PALETTE_META.find((item) => item.key === selectedToken) ?? PALETTE_META[0]

  const commit = useCallback((mutator: (draft: DesignSystem) => void) => {
    dispatch({
      type: 'set',
      next: updateObject(history.present, mutator),
    })
    setSaved(false)
  }, [history.present])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 3200)
  }

  useEffect(() => {
    const node = studioRef.current
    if (!node) return
    setVars(node, designSystem)
  }, [designSystem])

  useEffect(() => {
    const families = Array.from(new Set([designSystem.typography.headingFont, designSystem.typography.bodyFont, designSystem.typography.monoFont]))
    const href = `https://fonts.googleapis.com/css2?${families
      .map((font) => `family=${encodeURIComponent(font)}:wght@300;400;500;600;700;800`)
      .join('&')}&display=swap`
    const id = 'pdds-google-fonts'
    let link = document.getElementById(id) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = href
  }, [designSystem.typography.bodyFont, designSystem.typography.headingFont, designSystem.typography.monoFont])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isMod = event.ctrlKey || event.metaKey
      if (!isMod) return
      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        dispatch({ type: 'undo' })
      }
      if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
        event.preventDefault()
        dispatch({ type: 'redo' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function toggleSection(section: string) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  function updateToken(token: PaletteKey, color: string) {
    if (!isHexColor(color)) return
    commit((draft) => {
      draft.palette[token] = color
      Object.assign(draft, withRecentColors(draft, color))
    })
  }

  function generatePalette() {
    const hue = Math.floor(Math.random() * 360)
    const next = {
      primary: hslToHex(hue, 72, 43),
      accent: hslToHex((hue + 48) % 360, 82, 52),
      background: tone === 'light' ? hslToHex(hue, 34, 96) : hslToHex(hue, 34, 8),
      surface: tone === 'light' ? hslToHex(hue, 28, 91) : hslToHex(hue, 30, 13),
      card: tone === 'light' ? '#ffffff' : hslToHex(hue, 28, 16),
      border: tone === 'light' ? hslToHex(hue, 24, 83) : hslToHex(hue, 22, 25),
      textMain: tone === 'light' ? hslToHex(hue, 28, 12) : '#f8fafc',
      textMuted: tone === 'light' ? hslToHex(hue, 14, 42) : hslToHex(hue, 15, 70),
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: hslToHex((hue + 22) % 360, 78, 50),
    } satisfies Record<PaletteKey, string>

    dispatch({
      type: 'set',
      next: {
        ...designSystem,
        palette: next,
        background: {
          ...designSystem.background,
          stopA: next.background,
          stopB: next.surface,
          meshA: next.primary,
          meshB: next.accent,
          meshC: next.info,
        },
        brand: { ...designSystem.brand, faviconColor: next.primary },
        recentColors: [next.primary, next.accent, next.info, next.success, next.warning, next.danger],
      },
    })
    notify('Generated a harmonious palette.')
  }

  async function saveDesign() {
    setSaving(true)
    setSaved(false)
    try {
      const response = await fetch('/api/settings/design', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design: toCoreDesign(designSystem) }),
      })
      const data = (await response.json().catch(() => ({}))) as { design?: UserDashboardDesignSettings; error?: string }
      if (!response.ok || !data.design) {
        notify(getSaveError(data))
        return
      }
      applyUserDashboardDesign(data.design)
      onSaved?.(data.design)
      setSaved(true)
      notify('Design saved and applied.')
      window.setTimeout(() => setSaved(false), 1800)
    } finally {
      setSaving(false)
    }
  }

  function resetDesign() {
    if (!confirmReset) {
      setConfirmReset(true)
      setShaking(true)
      window.setTimeout(() => setShaking(false), 380)
      window.setTimeout(() => setConfirmReset(false), 3200)
      return
    }
    dispatch({ type: 'reset', next: makeDesignSystem(DEFAULT_DASHBOARD_DESIGN_CONFIG) })
    setConfirmReset(false)
    notify('Design reset to the clean baseline.')
  }

  async function exportCssTokens() {
    await navigator.clipboard.writeText(exportTokens(designSystem))
    notify('CSS variables copied to clipboard.')
  }

  function uploadLogo(file: File | null) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      commit((draft) => {
        draft.brand.logoDataUrl = reader.result as string
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div ref={studioRef} className="pdds" data-tone={tone}>
      <style>{STUDIO_CSS}</style>
      <div className="pdds-shell">
        <div className="pdds-controls">
          <div className="pdds-topbar">
            <div className="pdds-title">
              <div className="pdds-title-mark">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="pdds-kicker">Premium dashboard</div>
                <h2 className="pdds-heading">Design Studio</h2>
              </div>
            </div>
            <div className="pdds-actions">
              <button className="pdds-icon-button" type="button" onClick={() => dispatch({ type: 'undo' })} disabled={!history.past.length} aria-label="Undo" title="Undo">
                <Undo2 size={16} />
              </button>
              <button className="pdds-icon-button" type="button" onClick={() => dispatch({ type: 'redo' })} disabled={!history.future.length} aria-label="Redo" title="Redo">
                <Redo2 size={16} />
              </button>
              <button className="pdds-button" type="button" onClick={() => void exportCssTokens()}>
                <Clipboard size={15} />
                Export Tokens
              </button>
              <button className={`pdds-button pdds-button-danger ${shaking ? 'pdds-shake' : ''}`} data-confirm={confirmReset} type="button" onClick={resetDesign}>
                <RotateCcw size={15} />
                {confirmReset ? 'Confirm Reset' : 'Reset'}
              </button>
              <button className={`pdds-button ${saved ? 'pdds-button-success' : 'pdds-button-primary'}`} type="button" onClick={() => void saveDesign()} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={15} /> : saved ? <Check size={15} /> : <Save size={15} />}
                {saving ? 'Saving' : saved ? 'Saved' : 'Save Design'}
              </button>
            </div>
          </div>

          <div className="pdds-sections">
            <Section id="pdds-color" title="Color Studio" icon={Paintbrush} open={openSections.color} onToggle={() => toggleSection('color')}>
              <div className="pdds-preset-row">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    className="pdds-preset"
                    type="button"
                    aria-pressed={preset.label === 'Dark Pro' && tone === 'dark'}
                    onClick={() => dispatch({ type: 'set', next: { ...preset.value, brand: designSystem.brand } })}
                  >
                    {preset.label}
                  </button>
                ))}
                <button className="pdds-preset" type="button" onClick={generatePalette}>
                  <Sparkles size={14} />
                  Generate Palette
                </button>
              </div>
              <div className="pdds-token-grid">
                {PALETTE_META.map((token) => (
                  <ColorSwatch
                    key={token.key}
                    token={token.key}
                    label={token.label}
                    color={designSystem.palette[token.key]}
                    opacity={designSystem.opacity[token.key]}
                    selected={selectedToken === token.key}
                    onSelect={() => setSelectedToken(token.key)}
                  />
                ))}
              </div>
              <ColorPicker
                token={selectedToken}
                label={selectedMeta.label}
                value={designSystem.palette[selectedToken]}
                opacity={designSystem.opacity[selectedToken]}
                recentColors={designSystem.recentColors}
                onColor={(color) => updateToken(selectedToken, color)}
                onOpacity={(opacity) => commit((draft) => { draft.opacity[selectedToken] = opacity })}
              />
              <div className="pdds-gradient-grid">
                {(['solid', 'twoStop', 'mesh'] as GradientMode[]).map((mode) => (
                  <button key={mode} className="pdds-gradient-card" data-mode={mode} type="button" aria-pressed={designSystem.background.mode === mode} onClick={() => commit((draft) => { draft.background.mode = mode })}>
                    <span className="pdds-gradient-label">{mode === 'twoStop' ? '2-stop' : mode}</span>
                  </button>
                ))}
              </div>
              <div className="pdds-field-grid-3">
                <label className="pdds-label">
                  <span className="pdds-label-text">Stop A</span>
                  <input className="pdds-input" value={designSystem.background.stopA} onChange={(event) => commit((draft) => { if (isHexColor(event.currentTarget.value)) draft.background.stopA = event.currentTarget.value })} />
                </label>
                <label className="pdds-label">
                  <span className="pdds-label-text">Stop B</span>
                  <input className="pdds-input" value={designSystem.background.stopB} onChange={(event) => commit((draft) => { if (isHexColor(event.currentTarget.value)) draft.background.stopB = event.currentTarget.value })} />
                </label>
                <label className="pdds-label">
                  <span className="pdds-label-text">Mesh Tint</span>
                  <input className="pdds-input" value={designSystem.background.meshC} onChange={(event) => commit((draft) => { if (isHexColor(event.currentTarget.value)) draft.background.meshC = event.currentTarget.value })} />
                </label>
              </div>
            </Section>

            <Section id="pdds-type" title="Typography Control" icon={Type} open={openSections.typography} onToggle={() => toggleSection('typography')}>
              <div className="pdds-field-grid-3">
                <FontSelector label="Heading font" value={designSystem.typography.headingFont} previewClass="pdds-font-preview-heading" onChange={(value) => commit((draft) => { draft.typography.headingFont = value })} />
                <FontSelector label="Body font" value={designSystem.typography.bodyFont} previewClass="pdds-font-preview-body" onChange={(value) => commit((draft) => { draft.typography.bodyFont = value })} />
                <FontSelector label="Mono font" value={designSystem.typography.monoFont} previewClass="pdds-font-preview-mono" onChange={(value) => commit((draft) => { draft.typography.monoFont = value })} />
              </div>
              <div className="pdds-field-grid-3">
                <SliderControl label="Base size" value={designSystem.typography.baseSize} min={12} max={20} suffix="px" onChange={(value) => commit((draft) => { draft.typography.baseSize = value })} />
                <SliderControl label="Line height" value={designSystem.typography.lineHeight} min={1.2} max={2} step={0.05} onChange={(value) => commit((draft) => { draft.typography.lineHeight = value })} />
                <SliderControl label="Letter spacing" value={designSystem.typography.letterSpacing} min={0} max={1.2} step={0.05} suffix="px" onChange={(value) => commit((draft) => { draft.typography.letterSpacing = value })} />
              </div>
              {(['heading', 'body', 'labels'] as const).map((key) => (
                <div key={key}>
                  <div className="pdds-label-text">{key} weight</div>
                  <div className="pdds-weight-grid">
                    {WEIGHTS.map((weight) => (
                      <button key={weight} className="pdds-weight-button" type="button" aria-pressed={designSystem.typography.weights[key] === weight} onClick={() => commit((draft) => { draft.typography.weights[key] = weight })}>
                        {weight}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pdds-scale-preview">
                <div className="pdds-scale-h1">H1 Dashboard Command</div>
                <div className="pdds-scale-h2">H2 Workspace Health</div>
                <div className="pdds-scale-h3">H3 Active Projects</div>
                <div className="pdds-scale-body">Quarterly planning cadence, active owners, and delivery confidence stay visible here.</div>
                <div className="pdds-scale-caption">Caption / label preview</div>
              </div>
            </Section>

            <Section id="pdds-layout" title="Layout & Spacing" icon={PanelLeft} open={openSections.layout} onToggle={() => toggleSection('layout')}>
              <div className="pdds-segmented">
                <button className="pdds-segment" type="button" aria-pressed={designSystem.layout.sidebarSide === 'left'} onClick={() => commit((draft) => { draft.layout.sidebarSide = 'left' })}>
                  <PanelLeft size={15} />
                  Left
                </button>
                <button className="pdds-segment" type="button" aria-pressed={designSystem.layout.sidebarSide === 'right'} onClick={() => commit((draft) => { draft.layout.sidebarSide = 'right' })}>
                  <PanelRight size={15} />
                  Right
                </button>
              </div>
              <div className="pdds-field-grid">
                <SliderControl label="Sidebar width" value={designSystem.layout.sidebarWidth} min={200} max={320} suffix="px" onChange={(value) => commit((draft) => { draft.layout.sidebarWidth = value })} />
                <SliderControl label="Content max-width" value={designSystem.layout.contentMaxWidth} min={960} max={1600} suffix="px" onChange={(value) => commit((draft) => { draft.layout.contentMaxWidth = value })} />
              </div>
              <div className="pdds-density-grid">
                {(['compact', 'comfortable', 'spacious'] as Density[]).map((density) => (
                  <button key={density} className="pdds-density-card" data-density={density} type="button" aria-pressed={designSystem.layout.density === density} onClick={() => commit((draft) => { draft.layout.density = density })}>
                    <span className="pdds-density-name">{density}</span>
                    <span className="pdds-density-lines">
                      <span />
                      <span />
                      <span />
                    </span>
                  </button>
                ))}
              </div>
              <div className="pdds-segmented">
                {[
                  ['icons', 'Icons only'],
                  ['iconsLabels', 'Icons + Labels'],
                  ['fullLabels', 'Full labels'],
                ].map(([value, label]) => (
                  <button key={value} className="pdds-segment" type="button" aria-pressed={designSystem.layout.navStyle === value} onClick={() => commit((draft) => { draft.layout.navStyle = value as NavStyle })}>
                    {label}
                  </button>
                ))}
              </div>
            </Section>

            <Section id="pdds-radius" title="Shapes & Radius" icon={Box} open={openSections.radius} onToggle={() => toggleSection('radius')}>
              <SliderControl label="Global radius" value={designSystem.radius.global} min={0} max={24} suffix="px" onChange={(value) => commit((draft) => { draft.radius.global = value })} />
              <div className="pdds-shape-grid">
                {[
                  ['square', 0],
                  ['soft', 8],
                  ['rounded', 16],
                  ['pill', 24],
                ].map(([shape, radius]) => (
                  <button key={shape} className="pdds-shape-card" data-shape={shape} type="button" aria-pressed={designSystem.radius.preset === shape} onClick={() => commit((draft) => {
                    draft.radius.preset = shape as DesignSystem['radius']['preset']
                    draft.radius.global = Number(radius)
                    draft.radius.cards = Number(radius)
                    draft.radius.buttons = Number(radius)
                    draft.radius.inputs = Number(radius)
                    draft.components.button.radius = Number(radius)
                  })}>
                    <span className="pdds-shape-preview" />
                    <span className="pdds-shape-name">{shape}</span>
                  </button>
                ))}
              </div>
              <div className="pdds-field-grid-3">
                <SliderControl label="Cards" value={designSystem.radius.cards} min={0} max={24} suffix="px" onChange={(value) => commit((draft) => { draft.radius.cards = value })} />
                <SliderControl label="Buttons" value={designSystem.radius.buttons} min={0} max={24} suffix="px" onChange={(value) => commit((draft) => { draft.radius.buttons = value; draft.components.button.radius = value })} />
                <SliderControl label="Inputs" value={designSystem.radius.inputs} min={0} max={24} suffix="px" onChange={(value) => commit((draft) => { draft.radius.inputs = value })} />
                <SliderControl label="Badges" value={designSystem.radius.badges} min={0} max={24} suffix="px" onChange={(value) => commit((draft) => { draft.radius.badges = value; draft.components.badge.radius = value })} />
                <SliderControl label="Modals" value={designSystem.radius.modals} min={0} max={24} suffix="px" onChange={(value) => commit((draft) => { draft.radius.modals = value })} />
              </div>
            </Section>

            <Section id="pdds-effects" title="Effects & Depth" icon={Layers} open={openSections.effects} onToggle={() => toggleSection('effects')}>
              <div className="pdds-field-grid-3">
                <label className="pdds-label">
                  <span className="pdds-label-text">Card shadow</span>
                  <select className="pdds-select" value={designSystem.effects.cardShadow} onChange={(event) => commit((draft) => { draft.effects.cardShadow = event.currentTarget.value as ShadowStyle })}>
                    {(['none', 'soft', 'medium', 'hard', 'glow'] as ShadowStyle[]).map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="pdds-label">
                  <span className="pdds-label-text">Card surface</span>
                  <select className="pdds-select" value={designSystem.effects.cardSurface} onChange={(event) => commit((draft) => { draft.effects.cardSurface = event.currentTarget.value as SurfaceStyle })}>
                    <option value="flat">Flat</option>
                    <option value="subtleGradient">Subtle gradient</option>
                    <option value="glassmorphism">Glassmorphism</option>
                    <option value="bordered">Bordered</option>
                  </select>
                </label>
                <label className="pdds-label">
                  <span className="pdds-label-text">Background texture</span>
                  <select className="pdds-select" value={designSystem.effects.texture} onChange={(event) => commit((draft) => { draft.effects.texture = event.currentTarget.value as TextureStyle })}>
                    {(['none', 'noise', 'dots', 'lines', 'mesh'] as TextureStyle[]).map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
              <div className="pdds-segmented">
                {(['solid', 'frosted', 'transparent'] as SidebarStyle[]).map((value) => (
                  <button key={value} className="pdds-segment" type="button" aria-pressed={designSystem.effects.sidebarStyle === value} onClick={() => commit((draft) => { draft.effects.sidebarStyle = value })}>
                    {value}
                  </button>
                ))}
              </div>
            </Section>

            <Section id="pdds-components" title="Component Tokens" icon={BadgeCheck} open={openSections.components} onToggle={() => toggleSection('components')}>
              <div className="pdds-field-grid-3">
                <label className="pdds-label">
                  <span className="pdds-label-text">Button style</span>
                  <select className="pdds-select" value={designSystem.components.button.style} onChange={(event) => commit((draft) => { draft.components.button.style = event.currentTarget.value as ButtonStyle })}>
                    {(['solid', 'outline', 'ghost', 'gradient'] as ButtonStyle[]).map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <SliderControl label="Button height" value={designSystem.components.button.height} min={32} max={56} suffix="px" onChange={(value) => commit((draft) => { draft.components.button.height = value })} />
                <SliderControl label="Button weight" value={designSystem.components.button.weight} min={400} max={800} step={100} onChange={(value) => commit((draft) => { draft.components.button.weight = value })} />
                <SliderControl label="Input height" value={designSystem.components.input.height} min={32} max={56} suffix="px" onChange={(value) => commit((draft) => { draft.components.input.height = value })} />
                <SliderControl label="Border width" value={designSystem.components.input.borderWidth} min={1} max={3} suffix="px" onChange={(value) => commit((draft) => { draft.components.input.borderWidth = value })} />
                <SliderControl label="Placeholder opacity" value={designSystem.components.input.placeholderOpacity} min={0.3} max={1} step={0.05} onChange={(value) => commit((draft) => { draft.components.input.placeholderOpacity = value })} />
              </div>
              <div className="pdds-field-grid-3">
                <label className="pdds-label">
                  <span className="pdds-label-text">Focus ring</span>
                  <input className="pdds-input" value={designSystem.components.input.focusRing} onChange={(event) => commit((draft) => { if (isHexColor(event.currentTarget.value)) draft.components.input.focusRing = event.currentTarget.value })} />
                </label>
                <label className="pdds-label">
                  <span className="pdds-label-text">Badge padding</span>
                  <select className="pdds-select" value={designSystem.components.badge.paddingDensity} onChange={(event) => commit((draft) => { draft.components.badge.paddingDensity = event.currentTarget.value as Density })}>
                    {(['compact', 'comfortable', 'spacious'] as Density[]).map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="pdds-label">
                  <span className="pdds-label-text">Icon size</span>
                  <select className="pdds-select" value={designSystem.components.iconSize} onChange={(event) => commit((draft) => { draft.components.iconSize = event.currentTarget.value as DesignSystem['components']['iconSize'] })}>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </label>
              </div>
            </Section>

            <Section id="pdds-brand" title="Brand Identity" icon={ImageIcon} open={openSections.brand} onToggle={() => toggleSection('brand')}>
              <div className="pdds-field-grid">
                <label className="pdds-label">
                  <span className="pdds-label-text">Brand name</span>
                  <input className="pdds-input" value={designSystem.brand.name} maxLength={42} onChange={(event) => commit((draft) => { draft.brand.name = event.currentTarget.value })} />
                </label>
                <div className="pdds-upload-box">
                  <div className="pdds-brand-logo">
                    {designSystem.brand.logoDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={designSystem.brand.logoDataUrl} alt="" />
                    ) : (
                      designSystem.brand.name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <label className="pdds-upload-button">
                    <UploadCloud size={15} />
                    Logo upload
                    <input className="pdds-upload-input" type="file" accept="image/*" onChange={(event) => uploadLogo(event.currentTarget.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>
              <div className="pdds-field-grid-3">
                <SliderControl label="Logo size" value={designSystem.brand.logoSize} min={24} max={64} suffix="px" onChange={(value) => commit((draft) => { draft.brand.logoSize = value })} />
                <SliderControl label="Logo radius" value={designSystem.brand.logoRadius} min={0} max={24} suffix="px" onChange={(value) => commit((draft) => { draft.brand.logoRadius = value })} />
                <label className="pdds-label">
                  <span className="pdds-label-text">Favicon color</span>
                  <input className="pdds-input" value={designSystem.brand.faviconColor} onChange={(event) => commit((draft) => { if (isHexColor(event.currentTarget.value)) draft.brand.faviconColor = event.currentTarget.value })} />
                </label>
              </div>
              <div className="pdds-segmented">
                {(['concise', 'friendly', 'executive'] as Tone[]).map((value) => (
                  <button key={value} className="pdds-segment" type="button" aria-pressed={designSystem.brand.voiceTone === value} onClick={() => commit((draft) => { draft.brand.voiceTone = value })}>
                    {value}
                  </button>
                ))}
              </div>
            </Section>
          </div>
        </div>
        <aside className="pdds-preview-column">
          <PreviewDashboard designSystem={designSystem} />
        </aside>
      </div>
      {toast && (
        <div className="pdds-toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  )
}
