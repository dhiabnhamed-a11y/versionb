import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { NO_STORE_HEADERS } from '@/lib/http'
import {
  SettingsAccessError,
  getUserLanguageSettings,
  updateUserLanguageSettings,
  type SettingsSessionUser,
} from '@/lib/settings'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
if (!user) {
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const language = await getUserLanguageSettings(user.id)
return NextResponse.json({ language }, { headers: NO_STORE_HEADERS })
}, { auth: 'required' });

export const PATCH = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
if (!user) {
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

try {
const body = (await req.json().catch(() => ({}))) as { locale?: string | null }
const language = await updateUserLanguageSettings(user as SettingsSessionUser, body)
return NextResponse.json({ language }, { headers: NO_STORE_HEADERS })
} catch (error) {
if (error instanceof SettingsAccessError) {
  return NextResponse.json({ error: error.message }, { status: error.status })
}

console.error(error)
return NextResponse.json({ error: 'Failed to update language.' }, { status: 500 })
}
}, { auth: 'required' });
