'use client'

import { type DashboardButtonStyle, type DashboardCardShadow, type DashboardDesignConfig } from '@/lib/dashboard-design'

const LIVE_PREVIEW_STYLE_ID = 'taskit-dashboard-live-preview'

function hexToRgb(hex: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '0369a1'
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function rgba(hex: string, alpha: number) {
  const color = hexToRgb(hex)
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

function buttonColors(style: DashboardButtonStyle, design: DashboardDesignConfig) {
  if (style === 'soft') {
    return {
      background: rgba(design.palette.primary, 0.12),
      color: design.palette.primary,
      border: rgba(design.palette.primary, 0.24),
      hover: rgba(design.palette.primary, 0.18),
    }
  }

  if (style === 'outline') {
    return {
      background: 'transparent',
      color: design.palette.primary,
      border: design.palette.primary,
      hover: rgba(design.palette.primary, 0.08),
    }
  }

  if (style === 'minimal') {
    return {
      background: 'transparent',
      color: design.palette.primary,
      border: 'transparent',
      hover: rgba(design.palette.primary, 0.08),
    }
  }

  return {
    background: `linear-gradient(135deg, ${design.palette.primary} 0%, ${design.palette.accent} 100%)`,
    color: '#ffffff',
    border: 'transparent',
    hover: design.palette.accent,
  }
}

function cardShadowValue(shadow: DashboardCardShadow) {
  if (shadow === 'none') return 'none'
  if (shadow === 'strong') return '0 18px 48px rgba(11,22,40,0.16), 0 2px 10px rgba(11,22,40,0.08)'
  return '0 1px 2px rgba(11,22,40,0.05), 0 10px 30px rgba(11,22,40,0.06)'
}

function densityValues(density: DashboardDesignConfig['layout']['density']) {
  if (density === 'compact') return { shell: '1.25rem', card: '1rem', stat: '108px', gap: '0.85rem' }
  if (density === 'spacious') return { shell: '3rem', card: '1.75rem', stat: '148px', gap: '1.35rem' }
  return { shell: '2rem', card: '1.5rem', stat: '128px', gap: '1rem' }
}

export function compileRuntimeDashboardDesignCss(design: DashboardDesignConfig) {
  const button = buttonColors(design.buttons.style, design)
  const density = densityValues(design.layout.density)
  const background =
    design.background.style === 'gradient'
      ? `linear-gradient(135deg, ${design.background.gradientFrom} 0%, ${design.background.gradientTo} 100%)`
      : design.palette.background
  const cardBackground =
    design.cards.style === 'glass'
      ? 'color-mix(in srgb, var(--bg-card) 78%, transparent)'
      : design.cards.style === 'flat'
      ? 'var(--bg-card)'
      : 'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, white 4%), var(--bg-card))'
  const blur = design.cards.style === 'glass' || design.cards.glassLevel === 'strong' ? '24px' : design.cards.glassLevel === 'soft' ? '14px' : '0px'
  const motion = design.motion.intensity === 'reduced' ? '80ms' : design.motion.intensity === 'expressive' ? '320ms' : '180ms'

  return `
.dashboard-app-shell[data-user-design="active"] {
  --accent: ${design.palette.primary};
  --primary: ${design.palette.primary};
  --accent-bright: ${design.palette.accent};
  --accent-hover: ${design.palette.accent};
  --accent-gradient: linear-gradient(135deg, ${design.palette.primary} 0%, ${design.palette.accent} 100%);
  --accent-glow: ${rgba(design.palette.primary, 0.16)};
  --accent-ring: ${rgba(design.palette.primary, 0.32)};
  --accent-subtle: ${rgba(design.palette.primary, 0.1)};
  --bg-primary: ${design.palette.background};
  --bg: ${design.palette.background};
  --bg-secondary: ${design.palette.backgroundSoft};
  --bg-card: ${design.palette.card};
  --bg-elevated: ${design.palette.elevated};
  --sidebar-bg: ${design.palette.sidebar};
  --sidebar: ${design.palette.sidebar};
  --sidebar-surface: ${design.palette.sidebarSurface};
  --sidebar-border: ${design.palette.border};
  --sidebar-text: ${design.palette.textSecondary};
  --sidebar-text-active: ${design.palette.text};
  --sidebar-hover: ${rgba(design.palette.primary, 0.08)};
  --sidebar-active-bg: ${rgba(design.palette.primary, 0.12)};
  --sidebar-active-border: ${rgba(design.palette.primary, 0.28)};
  --border: ${design.palette.border};
  --border-light: ${rgba(design.palette.primary, 0.24)};
  --text-primary: ${design.palette.text};
  --text-secondary: ${design.palette.textSecondary};
  --text-muted: ${design.palette.textMuted};
  --text-light: ${rgba(design.palette.textMuted, 0.72)};
  --success: ${design.palette.success};
  --warning: ${design.palette.warning};
  --danger: ${design.palette.danger};
  --info: ${design.palette.info};
  --radius-sm: ${design.layout.navRadius}px;
  --radius-md: ${design.layout.cardRadius}px;
  --radius-lg: ${Math.min(32, design.layout.cardRadius + 4)}px;
  --font-sans: ${design.typography.fontFamily};
  --shadow-card: ${cardShadowValue(design.cards.shadow)};
  --user-sidebar-width: ${design.layout.sidebarWidth}px;
  --user-content-max-width: ${
    design.layout.layoutMode === 'fluid'
      ? 'min(100%, 1920px)'
      : design.layout.layoutMode === 'focus'
      ? `${Math.min(design.layout.contentWidth, 1080)}px`
      : `${design.layout.contentWidth}px`
  };
  --user-button-bg: ${button.background};
  --user-button-color: ${button.color};
  --user-button-border: ${button.border};
  --user-button-hover-bg: ${button.hover};
  --user-button-radius: ${design.buttons.radius}px;
  --user-button-height: ${design.buttons.height}px;
  --user-button-weight: ${design.buttons.fontWeight};
  --user-card-border-width: ${design.cards.borderWidth}px;
  --user-card-background: ${cardBackground};
  --user-card-backdrop-blur: ${blur};
  --user-motion-duration: ${motion};
  --user-dashboard-gap: ${density.gap};
  --user-shell-background: ${background};
  background: var(--user-shell-background);
  font-size: ${design.typography.baseSize}px;
  font-weight: ${design.typography.bodyWeight};
}
@media (min-width: 901px) {
  .dashboard-app-shell[data-user-design="active"]:not(.sidebar-collapsed) {
    grid-template-columns: ${design.layout.sidebarSide === 'right' ? 'minmax(0, 1fr) var(--user-sidebar-width)' : 'var(--user-sidebar-width) minmax(0, 1fr)'};
  }
  .dashboard-app-shell[data-user-design="active"].sidebar-collapsed {
    grid-template-columns: ${design.layout.sidebarSide === 'right' ? 'minmax(0, 1fr) 88px' : '88px minmax(0, 1fr)'};
  }
  .dashboard-app-shell[data-user-design="active"] .sidebar {
    order: ${design.layout.sidebarSide === 'right' ? '2' : '0'};
    ${design.layout.sidebarSide === 'right' ? 'border-right: 0; border-left: 1px solid var(--sidebar-border);' : ''}
  }
  .dashboard-app-shell[data-user-design="active"] .main-content { order: ${design.layout.sidebarSide === 'right' ? '1' : '0'}; }
}
.dashboard-app-shell[data-user-design="active"] .sidebar:not(.collapsed) { width: var(--user-sidebar-width); }
.dashboard-app-shell[data-user-design="active"] .dashboard-shell-body,
.dashboard-app-shell[data-user-design="active"] .dashboard-page { max-width: var(--user-content-max-width) !important; }
.dashboard-app-shell[data-user-design="active"] .dashboard-shell-body { padding-block: ${density.shell}; }
.dashboard-app-shell[data-user-design="active"] .card,
.dashboard-app-shell[data-user-design="active"] .dashboard-hero,
.dashboard-app-shell[data-user-design="active"] .stat-card,
.dashboard-app-shell[data-user-design="active"] .enterprise-widget-card {
  border-width: var(--user-card-border-width);
  background: var(--user-card-background);
  backdrop-filter: blur(var(--user-card-backdrop-blur));
  -webkit-backdrop-filter: blur(var(--user-card-backdrop-blur));
}
.dashboard-app-shell[data-user-design="active"] .card { padding: ${density.card}; }
.dashboard-app-shell[data-user-design="active"] .stat-card { min-height: ${density.stat}; }
.dashboard-app-shell[data-user-design="active"] .enterprise-dashboard-grid { gap: var(--user-dashboard-gap); }
.dashboard-app-shell[data-user-design="active"] .page-heading,
.dashboard-app-shell[data-user-design="active"] .panel-title { font-weight: ${design.typography.headingWeight}; }
.dashboard-app-shell[data-user-design="active"] .btn-primary,
.dashboard-app-shell[data-user-design="active"] .dashboard-shell-header a[href="/dashboard/admin/tasks"] {
  min-height: var(--user-button-height) !important;
  border-radius: var(--user-button-radius) !important;
  background: var(--user-button-bg) !important;
  color: var(--user-button-color) !important;
  border: 1px solid var(--user-button-border) !important;
  font-weight: var(--user-button-weight) !important;
}
.dashboard-app-shell[data-user-design="active"] .btn-primary:hover,
.dashboard-app-shell[data-user-design="active"] .dashboard-shell-header a[href="/dashboard/admin/tasks"]:hover { background: var(--user-button-hover-bg) !important; }
.dashboard-app-shell[data-user-design="active"] .btn-secondary,
.dashboard-app-shell[data-user-design="active"] .input,
.dashboard-app-shell[data-user-design="active"] .command-trigger { border-radius: var(--user-button-radius) !important; }
.dashboard-app-shell[data-user-design="active"] *,
.dashboard-app-shell[data-user-design="active"] *::before,
.dashboard-app-shell[data-user-design="active"] *::after { transition-duration: var(--user-motion-duration); }
${design.layout.sidebarStyle === 'glass' ? '.dashboard-app-shell[data-user-design="active"] .sidebar { background: color-mix(in srgb, var(--sidebar-bg) 78%, transparent); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); }' : ''}
${design.layout.sidebarStyle === 'floating' ? '@media (min-width: 901px) { .dashboard-app-shell[data-user-design="active"] { gap: 0.85rem; padding: 0.85rem; } .dashboard-app-shell[data-user-design="active"] .sidebar { border-radius: var(--radius-lg); border: 1px solid var(--sidebar-border); height: calc(100dvh - 1.7rem); } .dashboard-app-shell[data-user-design="active"] .dash-header { border-radius: var(--radius-lg); border: 1px solid var(--border); top: 0.85rem; } }' : ''}
`
}

export function applyLiveDashboardDesign(config: DashboardDesignConfig) {
  if (typeof document === 'undefined') return
  const shell = document.querySelector<HTMLElement>('.dashboard-app-shell')
  if (shell) shell.dataset.userDesign = 'active'

  let style = document.getElementById(LIVE_PREVIEW_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = LIVE_PREVIEW_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = compileRuntimeDashboardDesignCss(config)
}

export function clearLiveDashboardDesign() {
  if (typeof document === 'undefined') return
  document.getElementById(LIVE_PREVIEW_STYLE_ID)?.remove()
}
