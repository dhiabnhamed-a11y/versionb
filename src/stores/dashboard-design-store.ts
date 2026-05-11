'use client'

import { create } from 'zustand'
import {
  DEFAULT_DASHBOARD_DESIGN_CONFIG,
  normalizeDashboardDesignConfig,
  type DashboardDesignConfig,
} from '@/lib/dashboard-design'
import type { UserDashboardDesignSettings } from '@/lib/settings'

type DashboardDesignState = {
  design: UserDashboardDesignSettings | null
  config: DashboardDesignConfig
  studioOpen: boolean
  setDesign: (design: UserDashboardDesignSettings | null) => void
  setConfig: (config: DashboardDesignConfig) => void
  patchConfig: <K extends keyof DashboardDesignConfig>(
    section: K,
    value: Partial<DashboardDesignConfig[K]>
  ) => void
  setStudioOpen: (open: boolean) => void
}

export const useDashboardDesignStore = create<DashboardDesignState>((set) => ({
  design: null,
  config: DEFAULT_DASHBOARD_DESIGN_CONFIG,
  studioOpen: false,
  setDesign: (design) =>
    set({
      design,
      config: normalizeDashboardDesignConfig(design?.designJson),
    }),
  setConfig: (config) => set({ config: normalizeDashboardDesignConfig(config) }),
  patchConfig: (section, value) =>
    set((state) => ({
      config: normalizeDashboardDesignConfig({
        ...state.config,
        [section]: {
          ...(state.config[section] as Record<string, unknown>),
          ...value,
        },
      }),
    })),
  setStudioOpen: (studioOpen) => set({ studioOpen }),
}))
