'use client'

import { useEffect } from 'react'
import type { WorkspaceThemeSettings } from '@/lib/settings'
import { applyWorkspaceTheme } from '@/lib/theme-client'

export default function WorkspaceThemeProvider({ settings }: { settings: WorkspaceThemeSettings }) {
  useEffect(() => {
    applyWorkspaceTheme(settings)
  }, [settings])

  return null
}
