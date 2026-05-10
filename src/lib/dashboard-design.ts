export type DashboardDesignDensity = 'compact' | 'comfortable' | 'spacious'
export type DashboardButtonStyle = 'solid' | 'soft' | 'outline' | 'minimal'
export type DashboardCardShadow = 'none' | 'soft' | 'strong'
export type DashboardBackgroundStyle = 'solid' | 'gradient'
export type DashboardSidebarSide = 'left' | 'right'

export type DashboardDesignConfig = {
  version: 1
  brand: {
    name: string
    logoDataUrl: string | null
    logoSize: number
    logoRadius: number
  }
  palette: {
    primary: string
    accent: string
    background: string
    backgroundSoft: string
    card: string
    elevated: string
    sidebar: string
    sidebarSurface: string
    border: string
    text: string
    textSecondary: string
    textMuted: string
    success: string
    warning: string
    danger: string
    info: string
  }
  background: {
    style: DashboardBackgroundStyle
    gradientFrom: string
    gradientTo: string
  }
  typography: {
    fontFamily: string
    baseSize: number
    headingWeight: number
    bodyWeight: number
  }
  layout: {
    sidebarWidth: number
    sidebarSide: DashboardSidebarSide
    contentWidth: number
    density: DashboardDesignDensity
    navRadius: number
    cardRadius: number
  }
  buttons: {
    style: DashboardButtonStyle
    radius: number
    height: number
    fontWeight: number
  }
  cards: {
    shadow: DashboardCardShadow
    borderWidth: number
  }
}

export const DEFAULT_DASHBOARD_DESIGN_CONFIG: DashboardDesignConfig = {
  version: 1,
  brand: {
    name: 'TASKIT',
    logoDataUrl: null,
    logoSize: 30,
    logoRadius: 12,
  },
  palette: {
    primary: '#0369a1',
    accent: '#0891b2',
    background: '#f7f8fa',
    backgroundSoft: '#eef1f5',
    card: '#ffffff',
    elevated: '#f3f5f8',
    sidebar: '#ffffff',
    sidebarSurface: '#f6f8fb',
    border: '#e2e7ee',
    text: '#0b1628',
    textSecondary: '#2e4060',
    textMuted: '#64748b',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    info: '#0284c7',
  },
  background: {
    style: 'solid',
    gradientFrom: '#f7f8fa',
    gradientTo: '#eef1f5',
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    baseSize: 16,
    headingWeight: 700,
    bodyWeight: 400,
  },
  layout: {
    sidebarWidth: 280,
    sidebarSide: 'left',
    contentWidth: 1200,
    density: 'comfortable',
    navRadius: 10,
    cardRadius: 12,
  },
  buttons: {
    style: 'solid',
    radius: 8,
    height: 46,
    fontWeight: 700,
  },
  cards: {
    shadow: 'soft',
    borderWidth: 1,
  },
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function nullableString(value: unknown, fallback: string | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T) {
  return typeof value === 'string' && values.includes(value as T) ? (value as T) : fallback
}

export function normalizeDashboardDesignConfig(value: unknown): DashboardDesignConfig {
  const root = isObject(value) ? value : {}
  const defaults = DEFAULT_DASHBOARD_DESIGN_CONFIG
  const brand = isObject(root.brand) ? root.brand : {}
  const palette = isObject(root.palette) ? root.palette : isObject(root.theme) ? root.theme : {}
  const background = isObject(root.background) ? root.background : {}
  const typography = isObject(root.typography) ? root.typography : {}
  const layout = isObject(root.layout) ? root.layout : {}
  const buttons = isObject(root.buttons) ? root.buttons : {}
  const cards = isObject(root.cards) ? root.cards : {}

  return {
    version: 1,
    brand: {
      name: stringValue(brand.name, defaults.brand.name).slice(0, 42),
      logoDataUrl: nullableString(brand.logoDataUrl, defaults.brand.logoDataUrl),
      logoSize: numberValue(brand.logoSize, defaults.brand.logoSize),
      logoRadius: numberValue(brand.logoRadius, defaults.brand.logoRadius),
    },
    palette: {
      primary: stringValue(palette.primary ?? palette.primaryColor, defaults.palette.primary),
      accent: stringValue(palette.accent ?? palette.accentColor, defaults.palette.accent),
      background: stringValue(palette.background ?? palette.backgroundColor, defaults.palette.background),
      backgroundSoft: stringValue(palette.backgroundSoft, defaults.palette.backgroundSoft),
      card: stringValue(palette.card ?? palette.cardColor, defaults.palette.card),
      elevated: stringValue(palette.elevated ?? palette.elevatedColor, defaults.palette.elevated),
      sidebar: stringValue(palette.sidebar ?? palette.sidebarColor, defaults.palette.sidebar),
      sidebarSurface: stringValue(palette.sidebarSurface, defaults.palette.sidebarSurface),
      border: stringValue(palette.border ?? palette.borderColor, defaults.palette.border),
      text: stringValue(palette.text ?? palette.textColor, defaults.palette.text),
      textSecondary: stringValue(palette.textSecondary ?? palette.secondaryTextColor, defaults.palette.textSecondary),
      textMuted: stringValue(palette.textMuted ?? palette.mutedTextColor, defaults.palette.textMuted),
      success: stringValue(palette.success, defaults.palette.success),
      warning: stringValue(palette.warning, defaults.palette.warning),
      danger: stringValue(palette.danger, defaults.palette.danger),
      info: stringValue(palette.info, defaults.palette.info),
    },
    background: {
      style: enumValue(background.style, ['solid', 'gradient'] as const, defaults.background.style),
      gradientFrom: stringValue(background.gradientFrom, defaults.background.gradientFrom),
      gradientTo: stringValue(background.gradientTo, defaults.background.gradientTo),
    },
    typography: {
      fontFamily: stringValue(typography.fontFamily, defaults.typography.fontFamily),
      baseSize: numberValue(typography.baseSize, defaults.typography.baseSize),
      headingWeight: numberValue(typography.headingWeight, defaults.typography.headingWeight),
      bodyWeight: numberValue(typography.bodyWeight, defaults.typography.bodyWeight),
    },
    layout: {
      sidebarWidth: numberValue(layout.sidebarWidth, defaults.layout.sidebarWidth),
      sidebarSide: enumValue(layout.sidebarSide, ['left', 'right'] as const, defaults.layout.sidebarSide),
      contentWidth: numberValue(layout.contentWidth, defaults.layout.contentWidth),
      density: enumValue(layout.density, ['compact', 'comfortable', 'spacious'] as const, defaults.layout.density),
      navRadius: numberValue(layout.navRadius, defaults.layout.navRadius),
      cardRadius: numberValue(layout.cardRadius, defaults.layout.cardRadius),
    },
    buttons: {
      style: enumValue(buttons.style, ['solid', 'soft', 'outline', 'minimal'] as const, defaults.buttons.style),
      radius: numberValue(buttons.radius, defaults.buttons.radius),
      height: numberValue(buttons.height, defaults.buttons.height),
      fontWeight: numberValue(buttons.fontWeight, defaults.buttons.fontWeight),
    },
    cards: {
      shadow: enumValue(cards.shadow, ['none', 'soft', 'strong'] as const, defaults.cards.shadow),
      borderWidth: numberValue(cards.borderWidth, defaults.cards.borderWidth),
    },
  }
}

