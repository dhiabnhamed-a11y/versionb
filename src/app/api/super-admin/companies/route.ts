import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { listSuperAdminCompanies, reviewCompanyRegistration } from '@/lib/company-approvals'
import { isAuthorizedSuperAdminIdentity } from '@/lib/security'

type SessionUser = {
  id?: string
  email?: string | null
  role?: string | null
}

type AuthorizedSuperAdminUser = {
  id: string
  email?: string | null
  role?: string | null
}

function getSuperAdminUser(session: { user?: SessionUser | null } | null): AuthorizedSuperAdminUser | null {
  const user = session?.user
  if (!user?.id || !isAuthorizedSuperAdminIdentity(user)) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const user = getSuperAdminUser(session)
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const result = await listSuperAdminCompanies({
      status: searchParams.get('status') ?? 'PENDING',
      query: searchParams.get('query') ?? '',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load company registrations.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  const user = getSuperAdminUser(session)
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as {
      companyId?: string
      action?: 'APPROVE' | 'REJECT' | 'DISABLE'
      note?: string
    }

    const company = await reviewCompanyRegistration({
      companyId: body.companyId ?? '',
      reviewerId: user.id,
      action: body.action ?? 'REJECT',
      note: body.note,
    })

    return NextResponse.json({ company })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update company status.'
    const status =
      message.includes('not found') || message.includes('not found.')
        ? 404
        : message.includes('Only') || message.includes('Invalid') || message.includes('required')
          ? 400
          : 500

    if (status === 500) {
      console.error(error)
    }

    return NextResponse.json({ error: message }, { status })
  }
}
