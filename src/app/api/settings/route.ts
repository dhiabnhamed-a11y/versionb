import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { NO_STORE_HEADERS } from '@/lib/http'
import {
  getWorkspaceThemeSettings,
  SettingsAccessError,
  type SettingsSessionUser,
  updateWorkspaceThemeSettings,
} from '@/lib/settings'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as SettingsSessionUser
  const appearance = await getWorkspaceThemeSettings(user.companyId)

  return NextResponse.json({ appearance }, { headers: NO_STORE_HEADERS })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      primaryColor?: string
      backgroundColor?: string
      sidebarColor?: string
      themeMode?: 'light' | 'dark'
    }

    const appearance = await updateWorkspaceThemeSettings(session.user as SettingsSessionUser, body)

    return NextResponse.json({ appearance }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    if (error instanceof SettingsAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 })
  }
}
