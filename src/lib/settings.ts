import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  DEFAULT_DASHBOARD_DESIGN_CONFIG,
  normalizeDashboardDesignConfig,
  type DashboardBackgroundStyle,
  type DashboardButtonStyle,
  type DashboardCardShadow,
  type DashboardCardSurface,
  type DashboardDesignConfig,
  type DashboardDesignDensity,
  type DashboardSidebarSide,
} from '@/lib/dashboard-design'
import { DEFAULT_LOCALE, normalizeAppLocale, type AppLocale } from '@/lib/i18n'

export const SETTINGS_ADMIN_ROLES = ['OWNER', 'MANAGER'] as const
export const PUBLIC_WORKSPACE_ROLES = ['OWNER', 'MANAGER', 'WORKER'] as const

export type SettingsAdminRole = (typeof SETTINGS_ADMIN_ROLES)[number]
export type PublicWorkspaceRole = (typeof PUBLIC_WORKSPACE_ROLES)[number]
export type StoredWorkspaceRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE'
export type ThemeMode = 'light' | 'dark'

export type WorkspaceThemeSettings = {
  primaryColor: string
  backgroundColor: string
  sidebarColor: string
  themeMode: ThemeMode
}

export type DashboardDesignSourceType = 'json' | 'css'

export type UserDashboardDesignSettings = {
  enabled: boolean
  name: string | null
  sourceType: DashboardDesignSourceType | 'none'
  designJson: Prisma.JsonValue | null
  customCss: string | null
  compiledCss: string
  updatedAt: string | null
}

export type SettingsSessionUser = {
  id?: string
  role?: string | null
  companyId?: string | null
}

export class SettingsAccessError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'SettingsAccessError'
    this.status = status
  }
}

const DEFAULT_THEME_SETTINGS: WorkspaceThemeSettings = {
  primaryColor: '#0369a1',
  backgroundColor: '#f7f8fa',
  sidebarColor: '#ffffff',
  themeMode: 'light',
}

export const DEFAULT_USER_DASHBOARD_DESIGN: UserDashboardDesignSettings = {
  enabled: false,
  name: null,
  sourceType: 'none',
  designJson: null,
  customCss: null,
  compiledCss: '',
  updatedAt: null,
}

export type UserLanguageSettings = {
  locale: AppLocale
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
const CSS_COLOR_PATTERN =
  /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%a-z-]+\)|[a-z]+)$/i
const CSS_LENGTH_PATTERN = /^-?\d+(\.\d+)?(px|rem|em|vh|vw|dvh|dvw|%)$|^0$/i
const CSS_FORBIDDEN_PATTERN =
  /@import\b|javascript\s*:|expression\s*\(|behavior\s*:|-moz-binding|<\/?style\b|<script\b|url\s*\(\s*['"]?\s*(javascript:|data:text\/html)/i
const CSS_VARIABLE_NAME_PATTERN = /^--[a-z0-9-]+$/i
const USER_DESIGN_MAX_CHARS = 80_000
const USER_DESIGN_BUILDER_MAX_CHARS = 320_000
const USER_LOGO_MAX_CHARS = 240_000
const IMAGE_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i
const CLOUDINARY_IMAGE_HOST = 'res.cloudinary.com'
const DESIGN_STUDIO_FONT_FAMILIES = [
  'Geist',
  'Instrument Sans',
  'DM Sans',
  'Manrope',
  'Space Grotesk',
  'Inter',
  'JetBrains Mono',
  'IBM Plex Mono',
]

function designStudioFontStack(font: string) {
  return `'${font}', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
}

const FONT_FAMILY_OPTIONS = new Set([
  DEFAULT_DASHBOARD_DESIGN_CONFIG.typography.fontFamily,
  'Arial, Helvetica, sans-serif',
  'Georgia, "Times New Roman", serif',
  '"Trebuchet MS", Arial, sans-serif',
  '"Courier New", Courier, monospace',
  ...DESIGN_STUDIO_FONT_FAMILIES.map(designStudioFontStack),
])

function normalizeUpper(value?: string | null) {
  return value?.trim().toUpperCase() ?? ''
}

export function canManageSettings(role?: string | null) {
  const normalizedRole = normalizeUpper(role)
  return normalizedRole === 'OWNER' || normalizedRole === 'MANAGER'
}

export function toPublicWorkspaceRole(role?: string | null): PublicWorkspaceRole {
  const normalizedRole = normalizeUpper(role)
  if (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER') return normalizedRole
  return 'WORKER'
}

export function toStoredWorkspaceRole(role?: string | null): StoredWorkspaceRole | null {
  const normalizedRole = normalizeUpper(role)
  if (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER') return normalizedRole
  if (normalizedRole === 'WORKER' || normalizedRole === 'EMPLOYEE') return 'EMPLOYEE'
  return null
}

export function roleLabel(role?: string | null) {
  const publicRole = toPublicWorkspaceRole(role)
  return publicRole === 'WORKER' ? 'Worker' : publicRole.charAt(0) + publicRole.slice(1).toLowerCase()
}

export function sanitizeThemeSettings(input: Partial<WorkspaceThemeSettings>) {
  const primaryColor = input.primaryColor?.trim()
  const backgroundColor = input.backgroundColor?.trim()
  const sidebarColor = input.sidebarColor?.trim()
  const themeMode = input.themeMode === 'dark' ? 'dark' : input.themeMode === 'light' ? 'light' : undefined

  if (primaryColor !== undefined && !HEX_COLOR_PATTERN.test(primaryColor)) {
    throw new SettingsAccessError('Primary color must be a 6-digit hex color.')
  }

  if (backgroundColor !== undefined && !HEX_COLOR_PATTERN.test(backgroundColor)) {
    throw new SettingsAccessError('Background color must be a 6-digit hex color.')
  }

  if (sidebarColor !== undefined && !HEX_COLOR_PATTERN.test(sidebarColor)) {
    throw new SettingsAccessError('Sidebar color must be a 6-digit hex color.')
  }

  if (input.themeMode !== undefined && themeMode === undefined) {
    throw new SettingsAccessError('Theme mode must be light or dark.')
  }

  return {
    ...(primaryColor !== undefined ? { primaryColor } : {}),
    ...(backgroundColor !== undefined ? { backgroundColor } : {}),
    ...(sidebarColor !== undefined ? { sidebarColor } : {}),
    ...(themeMode !== undefined ? { themeMode } : {}),
  }
}

function assertSafeDesignText(content: string, label: string) {
  if (content.length > USER_DESIGN_MAX_CHARS) {
    throw new SettingsAccessError(`${label} must be smaller than 80 KB.`)
  }

  if (CSS_FORBIDDEN_PATTERN.test(content)) {
    throw new SettingsAccessError(`${label} contains CSS that cannot be saved.`)
  }
}

function sanitizeCss(content: string) {
  const css = content.replace(/\0/g, '').trim()
  assertSafeDesignText(css, 'CSS')
  return css
}

function sanitizeCssValue(value: unknown, label: string) {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  if (!text) return null
  if (text.length > 220 || /[{};]/.test(text) || CSS_FORBIDDEN_PATTERN.test(text)) {
    throw new SettingsAccessError(`${label} is not a safe CSS value.`)
  }

  return text
}

function sanitizeCssColor(value: unknown, label: string) {
  const text = sanitizeCssValue(value, label)
  if (!text) return null
  if (!CSS_COLOR_PATTERN.test(text)) {
    throw new SettingsAccessError(`${label} must be a valid CSS color.`)
  }

  return text
}

function sanitizeCssLength(value: unknown, label: string) {
  const text = typeof value === 'number' ? `${value}px` : sanitizeCssValue(value, label)
  if (!text) return null
  if (!CSS_LENGTH_PATTERN.test(text)) {
    throw new SettingsAccessError(`${label} must be a valid CSS length.`)
  }

  return text
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

function clampFloat(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

function sanitizeHexColor(value: string, label: string) {
  const text = value.trim()
  if (!HEX_COLOR_PATTERN.test(text)) {
    throw new SettingsAccessError(`${label} must be a 6-digit hex color.`)
  }

  return text
}

function sanitizeEnum<T extends string>(value: T, allowed: readonly T[], label: string) {
  if (!allowed.includes(value)) {
    throw new SettingsAccessError(`${label} is not supported.`)
  }

  return value
}

function sanitizeBrandName(value: string) {
  const text = value.replace(/\s+/g, ' ').trim().slice(0, 42)
  if (!text) return DEFAULT_DASHBOARD_DESIGN_CONFIG.brand.name
  if (/[<>]/.test(text)) {
    throw new SettingsAccessError('Brand name cannot contain markup.')
  }

  return text
}

function sanitizeLogoDataUrl(value: string | null) {
  if (!value) return null
  if (value.length > USER_LOGO_MAX_CHARS) {
    throw new SettingsAccessError('Logo image must be smaller than 180 KB.')
  }
  if (!IMAGE_DATA_URL_PATTERN.test(value)) {
    throw new SettingsAccessError('Logo must be a PNG, JPG, GIF, or WebP image.')
  }

  return value
}

function sanitizeBackgroundImageUrl(value: string | null) {
  if (!value) return null

  const text = value.trim()
  if (text.length > 1200 || CSS_FORBIDDEN_PATTERN.test(text)) {
    throw new SettingsAccessError('Background image URL is not safe to save.')
  }

  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new SettingsAccessError('Background image URL must be a valid Cloudinary URL.')
  }

  if (url.protocol !== 'https:' || url.hostname !== CLOUDINARY_IMAGE_HOST || !url.pathname.includes('/image/upload/')) {
    throw new SettingsAccessError('Background image must be uploaded to Cloudinary.')
  }

  return url.toString()
}

function sanitizeCloudinaryPublicId(value: string | null) {
  if (!value) return null
  const text = value.trim()
  if (!text) return null
  if (text.length > 240 || /[<>{};\\]/.test(text) || CSS_FORBIDDEN_PATTERN.test(text)) {
    throw new SettingsAccessError('Background image identifier is not safe to save.')
  }

  return text
}

function sanitizeFontFamily(value: string) {
  const text = sanitizeCssValue(value, 'Font family') ?? DEFAULT_DASHBOARD_DESIGN_CONFIG.typography.fontFamily
  if (!FONT_FAMILY_OPTIONS.has(text)) {
    throw new SettingsAccessError('Choose one of the available font families.')
  }

  return text
}

function sanitizeDashboardDesignConfig(input: unknown): DashboardDesignConfig {
  const design = normalizeDashboardDesignConfig(input)

  return {
    version: 1,
    brand: {
      name: sanitizeBrandName(design.brand.name),
      logoDataUrl: sanitizeLogoDataUrl(design.brand.logoDataUrl),
      logoSize: clampNumber(design.brand.logoSize, 20, 54, DEFAULT_DASHBOARD_DESIGN_CONFIG.brand.logoSize),
      logoRadius: clampNumber(design.brand.logoRadius, 0, 22, DEFAULT_DASHBOARD_DESIGN_CONFIG.brand.logoRadius),
    },
    palette: {
      primary: sanitizeHexColor(design.palette.primary, 'Primary color'),
      accent: sanitizeHexColor(design.palette.accent, 'Accent color'),
      background: sanitizeHexColor(design.palette.background, 'Background color'),
      backgroundSoft: sanitizeHexColor(design.palette.backgroundSoft, 'Soft background color'),
      card: sanitizeHexColor(design.palette.card, 'Card color'),
      elevated: sanitizeHexColor(design.palette.elevated, 'Elevated color'),
      sidebar: sanitizeHexColor(design.palette.sidebar, 'Sidebar color'),
      sidebarSurface: sanitizeHexColor(design.palette.sidebarSurface, 'Sidebar surface color'),
      border: sanitizeHexColor(design.palette.border, 'Border color'),
      text: sanitizeHexColor(design.palette.text, 'Text color'),
      textSecondary: sanitizeHexColor(design.palette.textSecondary, 'Secondary text color'),
      textMuted: sanitizeHexColor(design.palette.textMuted, 'Muted text color'),
      success: sanitizeHexColor(design.palette.success, 'Success color'),
      warning: sanitizeHexColor(design.palette.warning, 'Warning color'),
      danger: sanitizeHexColor(design.palette.danger, 'Danger color'),
      info: sanitizeHexColor(design.palette.info, 'Info color'),
    },
    background: {
      style: sanitizeEnum<DashboardBackgroundStyle>(design.background.style, ['solid', 'gradient', 'mesh', 'image'] as const, 'Background style'),
      gradientFrom: sanitizeHexColor(design.background.gradientFrom, 'Background gradient start'),
      gradientTo: sanitizeHexColor(design.background.gradientTo, 'Background gradient end'),
      meshA: sanitizeHexColor(design.background.meshA, 'Background mesh color A'),
      meshB: sanitizeHexColor(design.background.meshB, 'Background mesh color B'),
      meshC: sanitizeHexColor(design.background.meshC, 'Background mesh color C'),
      imageUrl: sanitizeBackgroundImageUrl(design.background.imageUrl),
      imagePublicId: sanitizeCloudinaryPublicId(design.background.imagePublicId),
      imageOverlayColor: sanitizeHexColor(design.background.imageOverlayColor, 'Background image overlay color'),
      imageOverlayOpacity: clampNumber(
        design.background.imageOverlayOpacity,
        0,
        85,
        DEFAULT_DASHBOARD_DESIGN_CONFIG.background.imageOverlayOpacity
      ),
    },
    typography: {
      fontFamily: sanitizeFontFamily(design.typography.fontFamily),
      baseSize: clampNumber(design.typography.baseSize, 13, 18, DEFAULT_DASHBOARD_DESIGN_CONFIG.typography.baseSize),
      headingWeight: clampNumber(design.typography.headingWeight, 500, 900, DEFAULT_DASHBOARD_DESIGN_CONFIG.typography.headingWeight),
      bodyWeight: clampNumber(design.typography.bodyWeight, 300, 700, DEFAULT_DASHBOARD_DESIGN_CONFIG.typography.bodyWeight),
    },
    layout: {
      sidebarWidth: clampNumber(design.layout.sidebarWidth, 220, 360, DEFAULT_DASHBOARD_DESIGN_CONFIG.layout.sidebarWidth),
      sidebarSide: sanitizeEnum<DashboardSidebarSide>(design.layout.sidebarSide, ['left', 'right'] as const, 'Sidebar side'),
      contentWidth: clampNumber(design.layout.contentWidth, 900, 1600, DEFAULT_DASHBOARD_DESIGN_CONFIG.layout.contentWidth),
      density: sanitizeEnum<DashboardDesignDensity>(design.layout.density, ['compact', 'comfortable', 'spacious'] as const, 'Density'),
      navRadius: clampNumber(design.layout.navRadius, 0, 24, DEFAULT_DASHBOARD_DESIGN_CONFIG.layout.navRadius),
      cardRadius: clampNumber(design.layout.cardRadius, 0, 24, DEFAULT_DASHBOARD_DESIGN_CONFIG.layout.cardRadius),
    },
    buttons: {
      style: sanitizeEnum<DashboardButtonStyle>(design.buttons.style, ['solid', 'soft', 'outline', 'minimal'] as const, 'Button style'),
      radius: clampNumber(design.buttons.radius, 0, 24, DEFAULT_DASHBOARD_DESIGN_CONFIG.buttons.radius),
      height: clampNumber(design.buttons.height, 36, 58, DEFAULT_DASHBOARD_DESIGN_CONFIG.buttons.height),
      fontWeight: clampNumber(design.buttons.fontWeight, 500, 900, DEFAULT_DASHBOARD_DESIGN_CONFIG.buttons.fontWeight),
    },
    cards: {
      shadow: sanitizeEnum<DashboardCardShadow>(design.cards.shadow, ['none', 'soft', 'strong'] as const, 'Card shadow'),
      borderWidth: clampNumber(design.cards.borderWidth, 0, 3, DEFAULT_DASHBOARD_DESIGN_CONFIG.cards.borderWidth),
      opacity: clampFloat(design.cards.opacity, 0.25, 1, DEFAULT_DASHBOARD_DESIGN_CONFIG.cards.opacity),
      surface: sanitizeEnum<DashboardCardSurface>(design.cards.surface, ['flat', 'subtleGradient', 'glassmorphism', 'bordered'] as const, 'Card surface'),
    },
  }
}

function asJsonObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SettingsAccessError(`${label} must be a JSON object.`)
  }

  return value as Record<string, unknown>
}

function optionalObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function appendVariable(lines: string[], name: string, value: string | null) {
  if (!value) return
  lines.push(`  ${name}: ${value};`)
}

function appendTokenVariables(lines: string[], tokens: Record<string, unknown>) {
  for (const [name, rawValue] of Object.entries(tokens)) {
    if (!CSS_VARIABLE_NAME_PATTERN.test(name)) continue
    const value = sanitizeCssValue(rawValue, name)
    appendVariable(lines, name, value)
  }
}

function hexToRgb(hex: string) {
  const normalized = HEX_COLOR_PATTERN.test(hex) ? hex.slice(1) : '0369a1'
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
  if (shadow === 'strong') return '0 16px 44px rgba(11,22,40,0.16), 0 2px 10px rgba(11,22,40,0.08)'
  return '0 1px 2px rgba(11,22,40,0.05), 0 10px 30px rgba(11,22,40,0.06)'
}

function cssUrl(value: string) {
  return `url(${JSON.stringify(value)})`
}

function dashboardShellBackground(design: DashboardDesignConfig) {
  if (design.background.style === 'image' && design.background.imageUrl) {
    const overlay = rgba(design.background.imageOverlayColor, design.background.imageOverlayOpacity / 100)
    return `linear-gradient(0deg, ${overlay}, ${overlay}), ${cssUrl(design.background.imageUrl)}`
  }

  if (design.background.style === 'mesh') {
    return [
      `radial-gradient(circle at 18% 18%, ${rgba(design.background.meshA, 0.34)}, transparent 34rem)`,
      `radial-gradient(circle at 84% 16%, ${rgba(design.background.meshB, 0.28)}, transparent 32rem)`,
      `radial-gradient(circle at 48% 88%, ${rgba(design.background.meshC, 0.3)}, transparent 38rem)`,
      design.palette.background,
    ].join(', ')
  }

  if (design.background.style === 'gradient') {
    return `linear-gradient(135deg, ${design.background.gradientFrom} 0%, ${design.background.gradientTo} 100%)`
  }

  return design.palette.background
}

function dashboardCardSurface(design: DashboardDesignConfig) {
  const card = rgba(design.palette.card, design.cards.opacity)

  if (design.cards.surface === 'glassmorphism') {
    return `color-mix(in srgb, ${card} 86%, transparent)`
  }

  if (design.cards.surface === 'subtleGradient') {
    return `linear-gradient(145deg, ${card}, ${rgba(design.palette.primary, Math.min(0.16, design.cards.opacity * 0.16))})`
  }

  return card
}

function densityPadding(density: DashboardDesignDensity) {
  if (density === 'compact') {
    return {
      shell: '1.25rem',
      card: '1rem',
      linkHeight: '38px',
      statHeight: '108px',
    }
  }

  if (density === 'spacious') {
    return {
      shell: '3rem',
      card: '1.75rem',
      linkHeight: '50px',
      statHeight: '148px',
    }
  }

  return {
    shell: '2rem',
    card: '1.5rem',
    linkHeight: '44px',
    statHeight: '128px',
  }
}

function compileDashboardDesignJson(design: Record<string, unknown>) {
  const noCodeDesign = sanitizeDashboardDesignConfig(design)
  const theme = optionalObject(design.theme)
  const tokens = {
    ...optionalObject(design.tokens),
    ...optionalObject(design.variables),
    ...optionalObject(design.cssVariables),
  }
  const layout = optionalObject(design.layout)
  const typography = optionalObject(design.typography)

  const button = buttonColors(noCodeDesign.buttons.style, noCodeDesign)
  const densityValues = densityPadding(noCodeDesign.layout.density)
  const hasImageBackground = noCodeDesign.background.style === 'image' && Boolean(noCodeDesign.background.imageUrl)
  const shellBackground = dashboardShellBackground(noCodeDesign)
  const cardSurface = dashboardCardSurface(noCodeDesign)

  const variableLines: string[] = [
    `  --accent: ${noCodeDesign.palette.primary};`,
    `  --primary: ${noCodeDesign.palette.primary};`,
    `  --accent-bright: ${noCodeDesign.palette.accent};`,
    `  --accent-hover: ${noCodeDesign.palette.accent};`,
    `  --accent-gradient: linear-gradient(135deg, ${noCodeDesign.palette.primary} 0%, ${noCodeDesign.palette.accent} 100%);`,
    `  --accent-glow: ${rgba(noCodeDesign.palette.primary, 0.16)};`,
    `  --accent-ring: ${rgba(noCodeDesign.palette.primary, 0.32)};`,
    `  --accent-subtle: ${rgba(noCodeDesign.palette.primary, 0.1)};`,
    `  --bg-primary: ${noCodeDesign.palette.background};`,
    `  --bg: ${noCodeDesign.palette.background};`,
    `  --bg-secondary: ${noCodeDesign.palette.backgroundSoft};`,
    `  --bg-card: ${rgba(noCodeDesign.palette.card, noCodeDesign.cards.opacity)};`,
    `  --bg-elevated: ${noCodeDesign.palette.elevated};`,
    `  --sidebar-bg: ${noCodeDesign.palette.sidebar};`,
    `  --sidebar: ${noCodeDesign.palette.sidebar};`,
    `  --sidebar-surface: ${noCodeDesign.palette.sidebarSurface};`,
    `  --sidebar-border: ${noCodeDesign.palette.border};`,
    `  --sidebar-text: ${noCodeDesign.palette.textSecondary};`,
    `  --sidebar-text-active: ${noCodeDesign.palette.text};`,
    `  --sidebar-hover: ${rgba(noCodeDesign.palette.primary, 0.08)};`,
    `  --sidebar-active-bg: ${rgba(noCodeDesign.palette.primary, 0.12)};`,
    `  --sidebar-active-border: ${rgba(noCodeDesign.palette.primary, 0.28)};`,
    `  --border: ${noCodeDesign.palette.border};`,
    `  --border-light: ${rgba(noCodeDesign.palette.primary, 0.24)};`,
    `  --text-primary: ${noCodeDesign.palette.text};`,
    `  --text-secondary: ${noCodeDesign.palette.textSecondary};`,
    `  --text-muted: ${noCodeDesign.palette.textMuted};`,
    `  --text-light: ${rgba(noCodeDesign.palette.textMuted, 0.72)};`,
    `  --success: ${noCodeDesign.palette.success};`,
    `  --warning: ${noCodeDesign.palette.warning};`,
    `  --danger: ${noCodeDesign.palette.danger};`,
    `  --info: ${noCodeDesign.palette.info};`,
    `  --radius-sm: ${noCodeDesign.layout.navRadius}px;`,
    `  --radius-md: ${noCodeDesign.layout.cardRadius}px;`,
    `  --radius-lg: ${Math.min(32, noCodeDesign.layout.cardRadius + 4)}px;`,
    `  --font-sans: ${noCodeDesign.typography.fontFamily};`,
    `  --shadow-card: ${cardShadowValue(noCodeDesign.cards.shadow)};`,
    `  --user-sidebar-width: ${noCodeDesign.layout.sidebarWidth}px;`,
    `  --user-content-max-width: ${noCodeDesign.layout.contentWidth}px;`,
    `  --user-button-bg: ${button.background};`,
    `  --user-button-color: ${button.color};`,
    `  --user-button-border: ${button.border};`,
    `  --user-button-hover-bg: ${button.hover};`,
    `  --user-button-radius: ${noCodeDesign.buttons.radius}px;`,
    `  --user-button-height: ${noCodeDesign.buttons.height}px;`,
    `  --user-button-weight: ${noCodeDesign.buttons.fontWeight};`,
    `  --user-card-border-width: ${noCodeDesign.cards.borderWidth}px;`,
    `  --user-card-surface: ${cardSurface};`,
    `  --user-shell-background: ${shellBackground};`,
    `  --user-shell-background-size: ${hasImageBackground ? 'cover' : 'auto'};`,
    `  --user-shell-background-position: ${hasImageBackground ? 'center' : '0 0'};`,
    `  --user-shell-background-repeat: ${hasImageBackground ? 'no-repeat' : 'repeat'};`,
    `  --user-shell-background-attachment: ${hasImageBackground ? 'fixed' : 'scroll'};`,
  ]
  appendVariable(variableLines, '--accent', sanitizeCssColor(theme.primaryColor ?? theme.accentColor ?? design.primaryColor, 'Primary color'))
  appendVariable(variableLines, '--primary', sanitizeCssColor(theme.primaryColor ?? theme.accentColor ?? design.primaryColor, 'Primary color'))
  appendVariable(variableLines, '--accent-hover', sanitizeCssColor(theme.accentHoverColor, 'Accent hover color'))
  appendVariable(variableLines, '--bg-primary', sanitizeCssColor(theme.backgroundColor ?? design.backgroundColor, 'Background color'))
  appendVariable(variableLines, '--bg', sanitizeCssColor(theme.backgroundColor ?? design.backgroundColor, 'Background color'))
  appendVariable(variableLines, '--bg-card', sanitizeCssColor(theme.cardColor, 'Card color'))
  appendVariable(variableLines, '--bg-elevated', sanitizeCssColor(theme.elevatedColor, 'Elevated color'))
  appendVariable(variableLines, '--sidebar-bg', sanitizeCssColor(theme.sidebarColor ?? design.sidebarColor, 'Sidebar color'))
  appendVariable(variableLines, '--sidebar', sanitizeCssColor(theme.sidebarColor ?? design.sidebarColor, 'Sidebar color'))
  appendVariable(variableLines, '--text-primary', sanitizeCssColor(theme.textColor, 'Text color'))
  appendVariable(variableLines, '--text-secondary', sanitizeCssColor(theme.secondaryTextColor, 'Secondary text color'))
  appendVariable(variableLines, '--text-muted', sanitizeCssColor(theme.mutedTextColor, 'Muted text color'))
  appendVariable(variableLines, '--border', sanitizeCssColor(theme.borderColor, 'Border color'))
  appendVariable(variableLines, '--radius-sm', sanitizeCssLength(theme.radius ?? layout.radius, 'Radius'))
  appendVariable(variableLines, '--radius-md', sanitizeCssLength(theme.cardRadius ?? layout.cardRadius, 'Card radius'))
  appendVariable(variableLines, '--radius-lg', sanitizeCssLength(layout.largeRadius, 'Large radius'))
  appendVariable(variableLines, '--font-sans', sanitizeCssValue(typography.fontFamily ?? design.fontFamily, 'Font family'))
  appendVariable(variableLines, '--dashboard-content-gutter', sanitizeCssLength(layout.gutter, 'Content gutter'))
  appendVariable(variableLines, '--user-sidebar-width', sanitizeCssLength(layout.sidebarWidth, 'Sidebar width'))
  appendVariable(variableLines, '--user-content-max-width', sanitizeCssLength(layout.contentMaxWidth, 'Content width'))
  appendTokenVariables(variableLines, tokens)

  const sideRules =
    noCodeDesign.layout.sidebarSide === 'right'
      ? [
          '@media (min-width: 901px) {',
          '  .dashboard-app-shell[data-user-design="active"]:not(.sidebar-collapsed) { grid-template-columns: minmax(0, 1fr) var(--user-sidebar-width); }',
          '  .dashboard-app-shell[data-user-design="active"].sidebar-collapsed { grid-template-columns: minmax(0, 1fr) 88px; }',
          '  .dashboard-app-shell[data-user-design="active"] .sidebar { order: 2; border-right: 0; border-left: 1px solid var(--sidebar-border); }',
          '  .dashboard-app-shell[data-user-design="active"] .main-content { order: 1; }',
          '}',
          '@media (max-width: 900px) {',
          '  .dashboard-app-shell[data-user-design="active"] .sidebar { inset: 0 0 0 auto; transform: translateX(100%); }',
          '  .dashboard-app-shell[data-user-design="active"] .sidebar.open { transform: translateX(0); }',
          '}',
        ]
      : [
          '@media (min-width: 901px) {',
          '  .dashboard-app-shell[data-user-design="active"]:not(.sidebar-collapsed) { grid-template-columns: var(--user-sidebar-width) minmax(0, 1fr); }',
          '}',
        ]

  const ruleLines: string[] = [
    '.dashboard-app-shell[data-user-design="active"] {',
    '  background: var(--user-shell-background) !important;',
    '  background-size: var(--user-shell-background-size) !important;',
    '  background-position: var(--user-shell-background-position) !important;',
    '  background-repeat: var(--user-shell-background-repeat) !important;',
    '  background-attachment: var(--user-shell-background-attachment) !important;',
    `  font-size: ${noCodeDesign.typography.baseSize}px;`,
    `  font-weight: ${noCodeDesign.typography.bodyWeight};`,
    '}',
    '.dashboard-app-shell[data-user-design="active"] .sidebar:not(.collapsed) { width: var(--user-sidebar-width); }',
    '.dashboard-app-shell[data-user-design="active"] .dashboard-shell-body, .dashboard-app-shell[data-user-design="active"] .dashboard-page { max-width: var(--user-content-max-width) !important; }',
    `.dashboard-app-shell[data-user-design="active"] .dashboard-shell-body { padding-block: ${densityValues.shell}; }`,
    '.dashboard-app-shell[data-user-design="active"] .dash-header { background: color-mix(in srgb, var(--bg-primary) 88%, transparent) !important; border-color: var(--border) !important; }',
    '.dashboard-app-shell[data-user-design="active"] .command-trigger { background: color-mix(in srgb, var(--bg-card) 86%, transparent) !important; border-color: var(--border) !important; }',
    '.dashboard-app-shell[data-user-design="active"] .sidebar { background: linear-gradient(180deg, rgba(255,255,255,0.035), transparent 24rem), var(--sidebar-bg) !important; }',
    '.dashboard-app-shell[data-user-design="active"] .card, .dashboard-app-shell[data-user-design="active"] .dashboard-hero, .dashboard-app-shell[data-user-design="active"] .stat-card, .dashboard-app-shell[data-user-design="active"] .ops-signal-card, .dashboard-app-shell[data-user-design="active"] .dashboard-disclosure {',
    '  background: var(--user-card-surface) !important;',
    '  border-color: var(--border) !important;',
    '  box-shadow: var(--shadow-card) !important;',
    '  border-width: var(--user-card-border-width) !important;',
    '}',
    '.dashboard-app-shell[data-user-design="active"] .ops-briefing-panel { background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent 38%), var(--user-card-surface) !important; }',
    '.dashboard-app-shell[data-user-design="active"] .metric-row, .dashboard-app-shell[data-user-design="active"] .compact-stat, .dashboard-app-shell[data-user-design="active"] .activity-card, .dashboard-app-shell[data-user-design="active"] .team-card, .dashboard-app-shell[data-user-design="active"] .ops-agent-row, .dashboard-app-shell[data-user-design="active"] .ops-risk-row, .dashboard-app-shell[data-user-design="active"] .ops-focus-row, .dashboard-app-shell[data-user-design="active"] .ops-loop-node, .dashboard-app-shell[data-user-design="active"] .ops-health-score, .dashboard-app-shell[data-user-design="active"] .ops-signal-icon, .dashboard-app-shell[data-user-design="active"] .ops-empty-state, .dashboard-app-shell[data-user-design="active"] .ops-graph-score > div, .dashboard-app-shell[data-user-design="active"] .ops-graph-coverage > div, .dashboard-app-shell[data-user-design="active"] .dashboard-hero-kicker {',
    '  background: var(--bg-elevated) !important;',
    '  border-color: var(--border) !important;',
    '}',
    `.dashboard-app-shell[data-user-design="active"] .card { padding: ${densityValues.card}; }`,
    `.dashboard-app-shell[data-user-design="active"] .sidebar-link, .dashboard-app-shell[data-user-design="active"] .sidebar-command-trigger { min-height: ${densityValues.linkHeight}; border-radius: var(--radius-sm); }`,
    `.dashboard-app-shell[data-user-design="active"] .stat-card { min-height: ${densityValues.statHeight}; }`,
    `.dashboard-app-shell[data-user-design="active"] .page-heading, .dashboard-app-shell[data-user-design="active"] .panel-title { font-weight: ${noCodeDesign.typography.headingWeight}; }`,
    '.dashboard-app-shell[data-user-design="active"] .btn-primary, .dashboard-app-shell[data-user-design="active"] .dashboard-shell-header a[href="/dashboard/admin/tasks"] {',
    '  min-height: var(--user-button-height) !important;',
    '  border-radius: var(--user-button-radius) !important;',
    '  background: var(--user-button-bg) !important;',
    '  color: var(--user-button-color) !important;',
    '  border: 1px solid var(--user-button-border) !important;',
    '  font-weight: var(--user-button-weight) !important;',
    '}',
    '.dashboard-app-shell[data-user-design="active"] .btn-primary:hover, .dashboard-app-shell[data-user-design="active"] .dashboard-shell-header a[href="/dashboard/admin/tasks"]:hover { background: var(--user-button-hover-bg) !important; }',
    '.dashboard-app-shell[data-user-design="active"] .btn-secondary, .dashboard-app-shell[data-user-design="active"] .input, .dashboard-app-shell[data-user-design="active"] .command-trigger { border-radius: var(--user-button-radius) !important; }',
    ...sideRules,
  ]

  const customCss =
    typeof design.css === 'string'
      ? sanitizeCss(design.css)
      : typeof design.customCss === 'string'
      ? sanitizeCss(design.customCss)
      : ''

  const compiled = [
    variableLines.length
      ? `.dashboard-app-shell[data-user-design="active"] {\n${variableLines.join('\n')}\n}`
      : '',
    ...ruleLines,
    customCss,
  ]
    .filter(Boolean)
    .join('\n\n')

  assertSafeDesignText(compiled, 'Compiled design')
  return compiled
}

function normalizeDesignSourceType(sourceType: string): DashboardDesignSourceType {
  const normalized = sourceType.trim().toLowerCase()
  if (normalized === 'json' || normalized === 'css') return normalized
  throw new SettingsAccessError('Design file must be JSON or CSS.')
}

function normalizeDesignFileName(fileName?: string | null) {
  const trimmed = fileName?.trim()
  if (!trimmed) return 'Dashboard design'
  return trimmed.slice(0, 160)
}

export async function getWorkspaceThemeSettings(companyId?: string | null): Promise<WorkspaceThemeSettings> {
  if (!companyId) return DEFAULT_THEME_SETTINGS

  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: {
      primaryColor: true,
      backgroundColor: true,
      sidebarColor: true,
      themeMode: true,
    },
  })

  if (!settings) return DEFAULT_THEME_SETTINGS

  return {
    primaryColor: settings.primaryColor,
    backgroundColor: settings.backgroundColor,
    sidebarColor: settings.sidebarColor,
    themeMode: settings.themeMode === 'dark' ? 'dark' : 'light',
  }
}

export async function getUserDashboardDesignSettings(userId?: string | null): Promise<UserDashboardDesignSettings> {
  if (!userId) return DEFAULT_USER_DASHBOARD_DESIGN

  const design = await prisma.userDashboardDesign.findUnique({
    where: { userId },
    select: {
      name: true,
      sourceType: true,
      designJson: true,
      customCss: true,
      compiledCss: true,
      enabled: true,
      updatedAt: true,
    },
  })

  if (!design || !design.enabled) return DEFAULT_USER_DASHBOARD_DESIGN

  return {
    enabled: design.enabled,
    name: design.name,
    sourceType: design.sourceType === 'css' ? 'css' : 'json',
    designJson: design.designJson,
    customCss: design.customCss,
    compiledCss: design.compiledCss,
    updatedAt: design.updatedAt.toISOString(),
  }
}

export async function getUserLanguageSettings(userId?: string | null): Promise<UserLanguageSettings> {
  if (!userId) return { locale: DEFAULT_LOCALE }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLocale: true },
  })

  return { locale: normalizeAppLocale(user?.preferredLocale) }
}

export async function updateUserLanguageSettings(
  requester: SettingsSessionUser,
  input: { locale?: string | null }
): Promise<UserLanguageSettings> {
  if (!requester.id) throw new SettingsAccessError('Unauthorized', 401)

  const locale = normalizeAppLocale(input.locale)
  const updated = await prisma.user.update({
    where: { id: requester.id },
    data: { preferredLocale: locale },
    select: { preferredLocale: true },
  })

  return { locale: normalizeAppLocale(updated.preferredLocale) }
}

export async function updateUserDashboardDesign(
  requester: SettingsSessionUser,
  input: {
    sourceType: string
    fileName?: string | null
    content: string
  }
) {
  if (!requester.id) throw new SettingsAccessError('Unauthorized', 401)

  const sourceType = normalizeDesignSourceType(input.sourceType)
  const name = normalizeDesignFileName(input.fileName)
  const content = input.content.replace(/\0/g, '').trim()
  if (!content) throw new SettingsAccessError('Design file cannot be empty.')
  if (content.length > USER_DESIGN_MAX_CHARS) {
    throw new SettingsAccessError('Design file must be smaller than 80 KB.')
  }

  let designJson: Prisma.InputJsonValue | undefined
  let customCss: string | null = null
  let compiledCss = ''

  if (sourceType === 'css') {
    customCss = sanitizeCss(content)
    compiledCss = customCss
  } else {
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new SettingsAccessError('JSON design file could not be parsed.')
    }

    const jsonObject = asJsonObject(parsed, 'Design JSON')
    compiledCss = compileDashboardDesignJson(jsonObject)
    designJson = jsonObject as Prisma.InputJsonObject
    customCss =
      typeof jsonObject.css === 'string'
        ? sanitizeCss(jsonObject.css)
        : typeof jsonObject.customCss === 'string'
        ? sanitizeCss(jsonObject.customCss)
        : null
  }

  const updated = await prisma.userDashboardDesign.upsert({
    where: { userId: requester.id },
    create: {
      userId: requester.id,
      name,
      sourceType,
      designJson,
      customCss,
      compiledCss,
      enabled: true,
    },
    update: {
      name,
      sourceType,
      designJson: designJson ?? Prisma.JsonNull,
      customCss,
      compiledCss,
      enabled: true,
    },
    select: {
      name: true,
      sourceType: true,
      designJson: true,
      customCss: true,
      compiledCss: true,
      enabled: true,
      updatedAt: true,
    },
  })

  return {
    enabled: updated.enabled,
    name: updated.name,
    sourceType: updated.sourceType === 'css' ? 'css' : 'json',
    designJson: updated.designJson,
    customCss: updated.customCss,
    compiledCss: updated.compiledCss,
    updatedAt: updated.updatedAt.toISOString(),
  } satisfies UserDashboardDesignSettings
}

export async function updateUserDashboardDesignBuilder(
  requester: SettingsSessionUser,
  input: unknown
) {
  if (!requester.id) throw new SettingsAccessError('Unauthorized', 401)

  const design = sanitizeDashboardDesignConfig(input)
  const content = JSON.stringify(design)
  if (content.length > USER_DESIGN_BUILDER_MAX_CHARS) {
    throw new SettingsAccessError('Dashboard design is too large.')
  }

  const compiledCss = compileDashboardDesignJson(design)
  const updated = await prisma.userDashboardDesign.upsert({
    where: { userId: requester.id },
    create: {
      userId: requester.id,
      name: `${design.brand.name} dashboard`,
      sourceType: 'json',
      designJson: design as Prisma.InputJsonObject,
      customCss: null,
      compiledCss,
      enabled: true,
    },
    update: {
      name: `${design.brand.name} dashboard`,
      sourceType: 'json',
      designJson: design as Prisma.InputJsonObject,
      customCss: null,
      compiledCss,
      enabled: true,
    },
    select: {
      name: true,
      sourceType: true,
      designJson: true,
      customCss: true,
      compiledCss: true,
      enabled: true,
      updatedAt: true,
    },
  })

  return {
    enabled: updated.enabled,
    name: updated.name,
    sourceType: 'json',
    designJson: updated.designJson,
    customCss: updated.customCss,
    compiledCss: updated.compiledCss,
    updatedAt: updated.updatedAt.toISOString(),
  } satisfies UserDashboardDesignSettings
}

export async function resetUserDashboardDesign(requester: SettingsSessionUser) {
  if (!requester.id) throw new SettingsAccessError('Unauthorized', 401)

  await prisma.userDashboardDesign.deleteMany({
    where: { userId: requester.id },
  })

  return DEFAULT_USER_DASHBOARD_DESIGN
}

type AdminActionClient = typeof prisma | Prisma.TransactionClient

export async function logAdminAction(
  client: AdminActionClient,
  input: {
    companyId: string
    actorId: string
    targetUserId?: string | null
    action: string
    metadata?: Prisma.InputJsonValue
  }
) {
  await client.adminActionLog.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId,
      targetUserId: input.targetUserId ?? null,
      action: input.action,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  })
}

export async function updateWorkspaceThemeSettings(
  requester: SettingsSessionUser,
  input: Partial<WorkspaceThemeSettings>
) {
  if (!requester.id) throw new SettingsAccessError('Unauthorized', 401)
  if (!requester.companyId) throw new SettingsAccessError('No company found for this account.', 400)
  if (!canManageSettings(requester.role)) throw new SettingsAccessError('Forbidden', 403)

  const sanitized = sanitizeThemeSettings(input)
  const updated = await prisma.$transaction(async (tx) => {
    const settings = await tx.companySettings.upsert({
      where: { companyId: requester.companyId! },
      create: {
        companyId: requester.companyId!,
        ...DEFAULT_THEME_SETTINGS,
        ...sanitized,
      },
      update: sanitized,
      select: {
        primaryColor: true,
        backgroundColor: true,
        sidebarColor: true,
        themeMode: true,
      },
    })

    await logAdminAction(tx, {
      companyId: requester.companyId!,
      actorId: requester.id!,
      action: 'SETTINGS_THEME_UPDATED',
      metadata: sanitized as Prisma.InputJsonObject,
    })

    return settings
  })

  return {
    primaryColor: updated.primaryColor,
    backgroundColor: updated.backgroundColor,
    sidebarColor: updated.sidebarColor,
    themeMode: updated.themeMode === 'dark' ? 'dark' : 'light',
  }
}

function assertRoleChangeAllowed(input: {
  requesterRole: string
  currentRole: StoredWorkspaceRole
  nextRole: StoredWorkspaceRole
  remainingOwnerCount: number
}) {
  if (input.currentRole === input.nextRole) {
    throw new SettingsAccessError('That user already has this role.')
  }

  if (input.currentRole === 'OWNER' && input.nextRole !== 'OWNER' && input.remainingOwnerCount <= 1) {
    throw new SettingsAccessError('You cannot remove the last workspace owner.', 409)
  }

  if (input.requesterRole === 'OWNER') {
    return
  }

  if (input.requesterRole !== 'MANAGER') {
    throw new SettingsAccessError('Forbidden', 403)
  }

  const managerCanPromoteWorker = input.currentRole === 'EMPLOYEE' && input.nextRole === 'MANAGER'
  const managerCanDemoteManager = input.currentRole === 'MANAGER' && input.nextRole === 'EMPLOYEE'

  if (!managerCanPromoteWorker && !managerCanDemoteManager) {
    throw new SettingsAccessError('Managers can only promote workers to managers or demote managers to workers.', 403)
  }
}

export async function changeWorkspaceUserRole(input: {
  requester: SettingsSessionUser
  targetUserId: string
  nextRole: string
}) {
  const requester = input.requester
  if (!requester.id) throw new SettingsAccessError('Unauthorized', 401)
  if (!requester.companyId) throw new SettingsAccessError('No company found for this account.', 400)
  if (!canManageSettings(requester.role)) throw new SettingsAccessError('Forbidden', 403)

  const nextRole = toStoredWorkspaceRole(input.nextRole)
  if (!nextRole) {
    throw new SettingsAccessError('Role must be OWNER, MANAGER, or WORKER.')
  }

  if (input.targetUserId === requester.id) {
    throw new SettingsAccessError('No one can change their own role.', 403)
  }

  const requesterRole = toStoredWorkspaceRole(requester.role)
  if (!requesterRole || requesterRole === 'EMPLOYEE') {
    throw new SettingsAccessError('Forbidden', 403)
  }

  return prisma.$transaction(async (tx) => {
    const [targetUser, ownerCount] = await Promise.all([
      tx.user.findFirst({
        where: {
          id: input.targetUserId,
          companyId: requester.companyId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      }),
      tx.user.count({
        where: {
          companyId: requester.companyId,
          role: 'OWNER',
        },
      }),
    ])

    if (!targetUser) {
      throw new SettingsAccessError('User not found in this workspace.', 404)
    }

    const currentRole = toStoredWorkspaceRole(targetUser.role)
    if (!currentRole) {
      throw new SettingsAccessError('This user role cannot be managed from workspace settings.', 403)
    }

    assertRoleChangeAllowed({
      requesterRole,
      currentRole,
      nextRole,
      remainingOwnerCount: ownerCount,
    })

    const updatedUser = await tx.user.update({
      where: { id: targetUser.id },
      data: { role: nextRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    await logAdminAction(tx, {
      companyId: requester.companyId!,
      actorId: requester.id!,
      targetUserId: updatedUser.id,
      action: 'USER_ROLE_CHANGED',
      metadata: {
        previousRole: toPublicWorkspaceRole(currentRole),
        nextRole: toPublicWorkspaceRole(nextRole),
      },
    })

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: toPublicWorkspaceRole(updatedUser.role),
      storedRole: updatedUser.role,
    }
  })
}

export async function getSettingsTeamUsers(companyId: string, currentUserId: string) {
  const users = await prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: toPublicWorkspaceRole(user.role),
    storedRole: user.role,
    roleLabel: roleLabel(user.role),
    isCurrentUser: user.id === currentUserId,
    joinedAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }))
}

function taskCompletionRate(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0
  const amount = typeof value === 'number' ? value : Number(value.toString())
  return Number.isFinite(amount) ? amount : 0
}

export async function buildWorkspaceStatsExport(companyId: string) {
  const [
    company,
    projects,
    tasks,
    team,
    taskActivities,
    adminActions,
    totalTasks,
    completedTasks,
    inProgressTasks,
    reviewTasks,
    todoTasks,
    overdueTasks,
    invoiceCurrencyGroups,
    paidInvoiceCurrencyGroups,
    outstandingInvoiceCurrencyGroups,
    invoiceStatusGroups,
    projectInvoiceGroups,
    recentInvoices,
  ] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, companyType: true },
    }),
    prisma.project.findMany({
      where: { companyId },
      select: {
        id: true,
        title: true,
        description: true,
        clientName: true,
        createdAt: true,
        updatedAt: true,
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.task.findMany({
      where: { project: { companyId } },
      select: {
        id: true,
        title: true,
        priority: true,
        deliverableType: true,
        stage: true,
        progress: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedTasks: {
          select: { id: true, stage: true, progress: true },
        },
        activities: {
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.activity.findMany({
      where: { task: { project: { companyId } } },
      select: {
        id: true,
        action: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, role: true } },
        task: {
          select: {
            id: true,
            title: true,
            stage: true,
            project: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.adminActionLog.findMany({
      where: { companyId },
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true, role: true } },
        targetUser: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.task.count({ where: { project: { companyId } } }),
    prisma.task.count({ where: { project: { companyId }, stage: 'DONE' } }),
    prisma.task.count({ where: { project: { companyId }, stage: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { project: { companyId }, stage: 'REVIEW' } }),
    prisma.task.count({ where: { project: { companyId }, stage: 'TODO' } }),
    prisma.task.count({
      where: {
        project: { companyId },
        stage: { not: 'DONE' },
        deadline: { lt: new Date() },
      },
    }),
    prisma.invoice.groupBy({
      by: ['currency'],
      where: { companyId },
      _count: { _all: true },
      _sum: { subtotal: true, taxTotal: true, total: true },
    }),
    prisma.invoice.groupBy({
      by: ['currency'],
      where: { companyId, status: 'paid' },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.invoice.groupBy({
      by: ['currency'],
      where: { companyId, status: { in: ['sent', 'overdue'] } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.invoice.groupBy({
      by: ['campaignId', 'currency'],
      where: { companyId, campaignId: { not: null } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.invoice.findMany({
      where: { companyId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        currency: true,
        total: true,
        clientName: true,
        campaignId: true,
        issueDate: true,
        dueDate: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  const teamPerformance = team.map((member) => {
    const total = member.assignedTasks.length
    const done = member.assignedTasks.filter((task) => task.stage === 'DONE').length
    const averageProgress = total
      ? Math.round(member.assignedTasks.reduce((sum, task) => sum + task.progress, 0) / total)
      : 0

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: toPublicWorkspaceRole(member.role),
      assignedTasks: total,
      completedTasks: done,
      completionRate: taskCompletionRate(done, total),
      averageProgress,
      activityCount: member.activities.length,
    }
  })
  const projectRevenue = new Map<string, Array<{ currency: string; invoiceCount: number; total: number }>>()
  for (const group of projectInvoiceGroups) {
    if (!group.campaignId) continue
    const rows = projectRevenue.get(group.campaignId) ?? []
    rows.push({
      currency: group.currency,
      invoiceCount: group._count._all,
      total: decimalToNumber(group._sum.total),
    })
    projectRevenue.set(group.campaignId, rows)
  }

  const moneyByCurrency = invoiceCurrencyGroups.map((group) => ({
    currency: group.currency,
    invoiceCount: group._count._all,
    subtotal: decimalToNumber(group._sum.subtotal),
    taxTotal: decimalToNumber(group._sum.taxTotal),
    total: decimalToNumber(group._sum.total),
    paidTotal: decimalToNumber(paidInvoiceCurrencyGroups.find((paid) => paid.currency === group.currency)?._sum.total),
    outstandingTotal: decimalToNumber(outstandingInvoiceCurrencyGroups.find((open) => open.currency === group.currency)?._sum.total),
  }))

  return {
    exportedAt: new Date().toISOString(),
    workspace: company,
    summary: {
      totalProjects: projects.length,
      totalTasks,
      completedTasks,
      inProgressTasks,
      reviewTasks,
      todoTasks,
      overdueTasks,
      completionRate: taskCompletionRate(completedTasks, totalTasks),
    },
    billing: {
      invoiceCount: invoiceCurrencyGroups.reduce((sum, group) => sum + group._count._all, 0),
      paidInvoiceCount: paidInvoiceCurrencyGroups.reduce((sum, group) => sum + group._count._all, 0),
      outstandingInvoiceCount: outstandingInvoiceCurrencyGroups.reduce((sum, group) => sum + group._count._all, 0),
      byCurrency: moneyByCurrency,
      byStatus: invoiceStatusGroups.map((group) => ({
        status: group.status,
        invoiceCount: group._count._all,
        total: decimalToNumber(group._sum.total),
      })),
      recentInvoices: recentInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        currency: invoice.currency,
        total: decimalToNumber(invoice.total),
        clientName: invoice.clientName,
        campaignId: invoice.campaignId,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate?.toISOString() ?? null,
      })),
    },
    projects: projects.map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      clientName: project.clientName,
      manager: project.manager,
      taskCount: project._count.tasks,
      revenueByCurrency: projectRevenue.get(project.id) ?? [],
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      deliverableType: task.deliverableType,
      stage: task.stage,
      progress: task.progress,
      deadline: task.deadline?.toISOString() ?? null,
      project: task.project,
      assignee: task.assignee,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    completionRates: {
      workspace: taskCompletionRate(completedTasks, totalTasks),
      byTeamMember: teamPerformance.map((member) => ({
        id: member.id,
        name: member.name,
        completionRate: member.completionRate,
      })),
    },
    teamPerformance,
    activityLogs: {
      taskActivity: taskActivities.flatMap((activity) => {
        if (!activity.user || !activity.task) return []

        return [
          {
            id: activity.id,
            action: activity.action,
            createdAt: activity.createdAt.toISOString(),
            user: {
              ...activity.user,
              role: toPublicWorkspaceRole(activity.user.role),
            },
            task: activity.task,
          },
        ]
      }),
      adminActions: adminActions.map((action) => ({
        id: action.id,
        action: action.action,
        metadata: action.metadata,
        createdAt: action.createdAt.toISOString(),
        actor: {
          ...action.actor,
          role: toPublicWorkspaceRole(action.actor.role),
        },
        targetUser: action.targetUser
          ? {
              ...action.targetUser,
              role: toPublicWorkspaceRole(action.targetUser.role),
            }
          : null,
      })),
    },
  }
}

function csvValue(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function csvRows(headers: string[], rows: unknown[][]) {
  return [headers.map(csvValue).join(','), ...rows.map((row) => row.map(csvValue).join(','))].join('\n')
}

export function buildStatsCsv(exportData: Awaited<ReturnType<typeof buildWorkspaceStatsExport>>) {
  const sections = [
    '# Summary',
    csvRows(
      ['Total projects', 'Total tasks', 'Completed tasks', 'In progress', 'Review', 'To do', 'Overdue', 'Completion rate', 'Invoices', 'Paid invoices', 'Outstanding invoices'],
      [
        [
          exportData.summary.totalProjects,
          exportData.summary.totalTasks,
          exportData.summary.completedTasks,
          exportData.summary.inProgressTasks,
          exportData.summary.reviewTasks,
          exportData.summary.todoTasks,
          exportData.summary.overdueTasks,
          `${exportData.summary.completionRate}%`,
          exportData.billing.invoiceCount,
          exportData.billing.paidInvoiceCount,
          exportData.billing.outstandingInvoiceCount,
        ],
      ]
    ),
    '# Billing',
    csvRows(
      ['Currency', 'Invoices', 'Subtotal', 'Tax total', 'Total', 'Paid total', 'Outstanding total'],
      exportData.billing.byCurrency.map((money) => [
        money.currency,
        money.invoiceCount,
        money.subtotal,
        money.taxTotal,
        money.total,
        money.paidTotal,
        money.outstandingTotal,
      ])
    ),
    '# Projects',
    csvRows(
      ['ID', 'Title', 'Client', 'Manager', 'Task count', 'Revenue', 'Created at', 'Updated at'],
      exportData.projects.map((project) => [
        project.id,
        project.title,
        project.clientName,
        project.manager?.name ?? '',
        project.taskCount,
        project.revenueByCurrency.map((money) => `${money.currency} ${money.total}`).join('; '),
        project.createdAt,
        project.updatedAt,
      ])
    ),
    '# Tasks',
    csvRows(
      ['ID', 'Title', 'Project', 'Assignee', 'Stage', 'Progress', 'Priority', 'Deadline', 'Created at'],
      exportData.tasks.map((task) => [
        task.id,
        task.title,
        task.project.title,
        task.assignee?.name ?? '',
        task.stage,
        task.progress,
        task.priority,
        task.deadline,
        task.createdAt,
      ])
    ),
    '# Team Performance',
    csvRows(
      ['ID', 'Name', 'Email', 'Role', 'Assigned tasks', 'Completed tasks', 'Completion rate', 'Average progress', 'Activity count'],
      exportData.teamPerformance.map((member) => [
        member.id,
        member.name,
        member.email,
        member.role,
        member.assignedTasks,
        member.completedTasks,
        `${member.completionRate}%`,
        `${member.averageProgress}%`,
        member.activityCount,
      ])
    ),
    '# Task Activity',
    csvRows(
      ['ID', 'Action', 'User', 'Task', 'Project', 'Created at'],
      exportData.activityLogs.taskActivity.map((activity) => [
        activity.id,
        activity.action,
        activity.user.name,
        activity.task.title,
        activity.task.project.title,
        activity.createdAt,
      ])
    ),
    '# Admin Actions',
    csvRows(
      ['ID', 'Action', 'Actor', 'Target user', 'Metadata', 'Created at'],
      exportData.activityLogs.adminActions.map((action) => [
        action.id,
        action.action,
        action.actor.name,
        action.targetUser?.name ?? '',
        action.metadata,
        action.createdAt,
      ])
    ),
  ]

  return `${sections.join('\n\n')}\n`
}

export type WorkspaceStatsExport = Awaited<ReturnType<typeof buildWorkspaceStatsExport>>
