import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { NO_STORE_HEADERS } from '@/lib/http'
import {
  SettingsAccessError,
  getUserLanguageSettings,
  updateUserLanguageSettings,
  type SettingsSessionUser,
} from '@/lib/settings'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as SettingsSessionUser
  const language = await getUserLanguageSettings(user.id)
  return NextResponse.json({ language }, { headers: NO_STORE_HEADERS })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { locale?: string | null }
    const language = await updateUserLanguageSettings(session.user as SettingsSessionUser, body)
    return NextResponse.json({ language }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    if (error instanceof SettingsAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)
    return NextResponse.json({ error: 'Failed to update language.' }, { status: 500 })
  }
}
