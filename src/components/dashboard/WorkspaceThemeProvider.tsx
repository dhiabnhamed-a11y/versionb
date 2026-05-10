'use client'

import { useEffect } from 'react'
import type { UserDashboardDesignSettings, WorkspaceThemeSettings } from '@/lib/settings'
import { applyUserDashboardDesign, applyWorkspaceTheme } from '@/lib/theme-client'

export default function WorkspaceThemeProvider({
  settings,
  userDesign,
}: {
  settings: WorkspaceThemeSettings
  userDesign: UserDashboardDesignSettings
}) {
  useEffect(() => {
    applyWorkspaceTheme(settings)
  }, [settings])

  useEffect(() => {
    applyUserDashboardDesign(userDesign)
  }, [userDesign])

  return null
}
