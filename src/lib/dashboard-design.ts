export type DashboardDesignDensity = 'compact' | 'comfortable' | 'spacious'
export type DashboardButtonStyle = 'solid' | 'soft' | 'outline' | 'minimal'
export type DashboardCardShadow = 'none' | 'soft' | 'strong'
export type DashboardBackgroundStyle = 'solid' | 'gradient'
export type DashboardSidebarSide = 'left' | 'right'
export type DashboardSidebarStyle = 'solid' | 'glass' | 'floating'
export type DashboardLayoutMode = 'contained' | 'fluid' | 'focus'
export type DashboardGlassLevel = 'none' | 'soft' | 'strong'
export type DashboardAnimationIntensity = 'reduced' | 'balanced' | 'expressive'
export type DashboardIconStyle = 'line' | 'duotone' | 'solid'
export type DashboardLayoutPreset = 'executive' | 'operations' | 'focus'
export type DashboardWidgetType =
  | 'priorityMetrics'
  | 'activityTrend'
  | 'taskBreakdown'
  | 'teamPerformance'
  | 'recentActivity'
  | 'workspaceSignals'
  | 'statusMix'
  | 'rolesDistribution'
  | 'agencySetup'

export type DashboardWidgetConfig = {
  id: string
  type: DashboardWidgetType
  title: string
  visible: boolean
  collapsed: boolean
  colSpan: 1 | 2 | 3 | 4
  rowSpan: 1 | 2 | 3
  order: number
}

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
    sidebarStyle: DashboardSidebarStyle
    layoutMode: DashboardLayoutMode
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
    glassLevel: DashboardGlassLevel
    style: 'flat' | 'elevated' | 'glass'
  }
  motion: {
    intensity: DashboardAnimationIntensity
  }
  icons: {
    style: DashboardIconStyle
  }
  navigation: {
    hiddenHrefs: string[]
  }
  dashboard: {
    preset: DashboardLayoutPreset
    widgets: DashboardWidgetConfig[]
  }
}

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  {
    id: 'priority-metrics',
    type: 'priorityMetrics',
    title: 'Priority Metrics',
    visible: true,
    collapsed: false,
    colSpan: 4,
    rowSpan: 1,
    order: 0,
  },
  {
    id: 'activity-trend',
    type: 'activityTrend',
    title: 'Activity Trend',
    visible: true,
    collapsed: false,
    colSpan: 3,
    rowSpan: 2,
    order: 1,
  },
  {
    id: 'task-breakdown',
    type: 'taskBreakdown',
    title: 'Task Breakdown',
    visible: true,
    collapsed: false,
    colSpan: 2,
    rowSpan: 2,
    order: 2,
  },
  {
    id: 'team-performance',
    type: 'teamPerformance',
    title: 'Team Performance',
    visible: true,
    collapsed: false,
    colSpan: 2,
    rowSpan: 2,
    order: 3,
  },
  {
    id: 'recent-activity',
    type: 'recentActivity',
    title: 'Recent Activity',
    visible: true,
    collapsed: false,
    colSpan: 2,
    rowSpan: 2,
    order: 4,
  },
  {
    id: 'workspace-signals',
    type: 'workspaceSignals',
    title: 'Workspace Signals',
    visible: true,
    collapsed: false,
    colSpan: 4,
    rowSpan: 1,
    order: 5,
  },
  {
    id: 'status-mix',
    type: 'statusMix',
    title: 'Status Mix',
    visible: false,
    collapsed: false,
    colSpan: 2,
    rowSpan: 2,
    order: 6,
  },
  {
    id: 'roles-distribution',
    type: 'rolesDistribution',
    title: 'Roles Distribution',
    visible: false,
    collapsed: false,
    colSpan: 2,
    rowSpan: 2,
    order: 7,
  },
  {
    id: 'agency-setup',
    type: 'agencySetup',
    title: 'Agency Setup',
    visible: true,
    collapsed: false,
    colSpan: 4,
    rowSpan: 1,
    order: 8,
  },
]

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
    sidebarStyle: 'solid',
    layoutMode: 'contained',
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
    glassLevel: 'none',
    style: 'elevated',
  },
  motion: {
    intensity: 'balanced',
  },
  icons: {
    style: 'line',
  },
  navigation: {
    hiddenHrefs: [],
  },
  dashboard: {
    preset: 'executive',
    widgets: DEFAULT_DASHBOARD_WIDGETS,
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

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T) {
  return typeof value === 'string' && values.includes(value as T) ? (value as T) : fallback
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

function normalizeWidgetConfig(value: unknown, fallback: DashboardWidgetConfig): DashboardWidgetConfig {
  const widget = isObject(value) ? value : {}
  const colSpan = enumValue(String(widget.colSpan), ['1', '2', '3', '4'] as const, String(fallback.colSpan))
  const rowSpan = enumValue(String(widget.rowSpan), ['1', '2', '3'] as const, String(fallback.rowSpan))
  return {
    id: stringValue(widget.id, fallback.id).slice(0, 80),
    type: enumValue(
      widget.type,
      [
        'priorityMetrics',
        'activityTrend',
        'taskBreakdown',
        'teamPerformance',
        'recentActivity',
        'workspaceSignals',
        'statusMix',
        'rolesDistribution',
        'agencySetup',
      ] as const,
      fallback.type
    ),
    title: stringValue(widget.title, fallback.title).slice(0, 80),
    visible: booleanValue(widget.visible, fallback.visible),
    collapsed: booleanValue(widget.collapsed, fallback.collapsed),
    colSpan: Number(colSpan) as 1 | 2 | 3 | 4,
    rowSpan: Number(rowSpan) as 1 | 2 | 3,
    order: numberValue(widget.order, fallback.order),
  }
}

function normalizeDashboardWidgets(value: unknown) {
  const incoming = Array.isArray(value) ? value : []
  const widgets: DashboardWidgetConfig[] = []
  const seenIds = new Set<string>()

  for (const item of incoming) {
    if (!isObject(item)) continue
    const fallback = DEFAULT_DASHBOARD_WIDGETS.find((widget) => widget.type === item.type)
    if (!fallback) continue
    const widget = normalizeWidgetConfig(item, fallback)
    const baseId = widget.id || fallback.id
    let nextId = baseId
    let suffix = 2
    while (seenIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`
      suffix += 1
    }
    seenIds.add(nextId)
    widgets.push({ ...widget, id: nextId })
  }

  for (const fallback of DEFAULT_DASHBOARD_WIDGETS) {
    if (widgets.some((widget) => widget.type === fallback.type)) continue
    widgets.push(fallback)
  }

  return widgets.sort((a, b) => a.order - b.order).map((widget, order) => ({ ...widget, order }))
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
  const motion = isObject(root.motion) ? root.motion : {}
  const icons = isObject(root.icons) ? root.icons : {}
  const navigation = isObject(root.navigation) ? root.navigation : {}
  const dashboard = isObject(root.dashboard) ? root.dashboard : {}

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
      sidebarStyle: enumValue(layout.sidebarStyle, ['solid', 'glass', 'floating'] as const, defaults.layout.sidebarStyle),
      layoutMode: enumValue(layout.layoutMode, ['contained', 'fluid', 'focus'] as const, defaults.layout.layoutMode),
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
      glassLevel: enumValue(cards.glassLevel, ['none', 'soft', 'strong'] as const, defaults.cards.glassLevel),
      style: enumValue(cards.style, ['flat', 'elevated', 'glass'] as const, defaults.cards.style),
    },
    motion: {
      intensity: enumValue(motion.intensity, ['reduced', 'balanced', 'expressive'] as const, defaults.motion.intensity),
    },
    icons: {
      style: enumValue(icons.style, ['line', 'duotone', 'solid'] as const, defaults.icons.style),
    },
    navigation: {
      hiddenHrefs: normalizeStringArray(navigation.hiddenHrefs, defaults.navigation.hiddenHrefs).slice(0, 40),
    },
    dashboard: {
      preset: enumValue(dashboard.preset, ['executive', 'operations', 'focus'] as const, defaults.dashboard.preset),
      widgets: normalizeDashboardWidgets(dashboard.widgets),
    },
  }
}
