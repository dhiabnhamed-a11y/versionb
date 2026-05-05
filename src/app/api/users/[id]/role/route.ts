import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { NO_STORE_HEADERS } from '@/lib/http'
import {
  changeWorkspaceUserRole,
  SettingsAccessError,
  type SettingsSessionUser,
} from '@/lib/settings'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { role?: string }

    const user = await changeWorkspaceUserRole({
      requester: session.user as SettingsSessionUser,
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
