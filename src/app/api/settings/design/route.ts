import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { NO_STORE_HEADERS } from '@/lib/http'
import {
  getUserDashboardDesignSettings,
  resetUserDashboardDesign,
  SettingsAccessError,
  type SettingsSessionUser,
  updateUserDashboardDesign,
  updateUserDashboardDesignBuilder,
} from '@/lib/settings'

export const runtime = 'nodejs'

function inferSourceType(file: File) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.json') || file.type === 'application/json') return 'json'
  if (name.endsWith('.css') || file.type === 'text/css') return 'css'
  return ''
}

export async function GET() {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const design = await getUserDashboardDesignSettings(user.id)
  return NextResponse.json({ design }, { headers: NO_STORE_HEADERS })
}

export async function POST(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw new SettingsAccessError('Upload a JSON or CSS design file.')
    }

    const sourceType = inferSourceType(file)
    if (!sourceType) {
      throw new SettingsAccessError('Design file must end in .json or .css.')
    }

    const design = await updateUserDashboardDesign(user as SettingsSessionUser, {
      sourceType,
      fileName: file.name,
      content: await file.text(),
    })

    return NextResponse.json({ design }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    if (error instanceof SettingsAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)
    return NextResponse.json({ error: 'Failed to save dashboard design.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => null)) as { design?: unknown } | null
    if (!body || !('design' in body)) {
      throw new SettingsAccessError('Dashboard design is required.')
    }

    const design = await updateUserDashboardDesignBuilder(user as SettingsSessionUser, body.design)
    return NextResponse.json({ design }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    if (error instanceof SettingsAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)
    return NextResponse.json({ error: 'Failed to save dashboard design.' }, { status: 500 })
  }
}

export async function DELETE() {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const design = await resetUserDashboardDesign(user as SettingsSessionUser)
    return NextResponse.json({ design }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    if (error instanceof SettingsAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)
    return NextResponse.json({ error: 'Failed to reset dashboard design.' }, { status: 500 })
  }
}
