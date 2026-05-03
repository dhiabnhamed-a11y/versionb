import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { createCompanyInvite, getInviteTtlHours, InviteFlowError, listCompanyInvites } from '@/lib/invites'
import { emitCompanyRealtime } from '@/lib/realtime-server'

type SessionUser = {
  id: string
  role?: string
  companyId?: string | null
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as SessionUser
  if (!user.companyId) {
    return NextResponse.json([])
  }

  if (user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const invites = await listCompanyInvites(user.companyId)
    return NextResponse.json(invites)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load invites.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as SessionUser
  if (!user.companyId) {
    return NextResponse.json({ error: 'No company found for this account.' }, { status: 400 })
  }

  if (!user.id || user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as {
      email?: string
      role?: string
      ttlHours?: number
    }

    const invite = await createCompanyInvite({
      companyId: user.companyId,
      companyAdminId: user.id,
      companyAdminRole: user.role ?? 'EMPLOYEE',
      email: body.email ?? '',
      role: body.role ?? 'EMPLOYEE',
      ttlHours: body.ttlHours ?? getInviteTtlHours(),
    })

    emitCompanyRealtime(user.companyId, 'employee_invited', { invite })

    return NextResponse.json(invite, { status: 201 })
  } catch (error) {
    if (error instanceof InviteFlowError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)
    return NextResponse.json({ error: 'Failed to create invite.' }, { status: 500 })
  }
}
