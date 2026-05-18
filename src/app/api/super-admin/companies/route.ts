import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { listSuperAdminCompanies, reviewCompanyRegistration } from '@/lib/company-approvals'
import { isAuthorizedSuperAdminIdentity } from '@/lib/security'

function getSuperAdminUser(user: Awaited<ReturnType<typeof requireSessionUser>>) {
  if (!user.id || !isAuthorizedSuperAdminIdentity(user)) return null
  return user
}

export async function GET(req: NextRequest) {
  const actor = getSuperAdminUser(await requireSessionUser())
  if (!actor) {
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
  const actor = getSuperAdminUser(await requireSessionUser())
  if (!actor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as {
      companyId?: string
      action?: 'APPROVE' | 'REJECT' | 'DISABLE'
      note?: string
    }

    if (!body.companyId || !body.action) {
      return NextResponse.json({ error: 'companyId and action are required.' }, { status: 400 })
    }

    const result = await reviewCompanyRegistration({
      companyId: body.companyId,
      action: body.action,
      note: body.note,
      reviewerId: actor.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to review company registration.' }, { status: 500 })
  }
}
