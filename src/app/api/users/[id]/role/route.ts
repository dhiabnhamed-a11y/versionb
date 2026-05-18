import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { NO_STORE_HEADERS } from '@/lib/http'
import {
  changeWorkspaceUserRole,
  SettingsAccessError,
  type SettingsSessionUser,
} from '@/lib/settings'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requester = await requireSessionUser()

  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { role?: string }

    const user = await changeWorkspaceUserRole({
      requester: requester as SettingsSessionUser,
      targetUserId: id,
      nextRole: body.role ?? '',
    })

    return NextResponse.json({ user }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    if (error instanceof SettingsAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)
    return NextResponse.json({ error: 'Failed to update user role.' }, { status: 500 })
  }
}
