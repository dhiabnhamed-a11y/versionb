import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { listCompanyAccessRequests, reviewCompanyAccessRequest, submitDomainAccessRequest } from '@/lib/onboarding'
import { InviteFlowError } from '@/lib/invites'

export async function GET() {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!user.companyId) {
    return NextResponse.json([])
  }

  if (!user.id || user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const requests = await listCompanyAccessRequests(user.companyId)
    return NextResponse.json(requests)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load access requests.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string
      email?: string
      role?: string
    }

    const request = await submitDomainAccessRequest({
      name: body.name ?? '',
      email: body.email ?? '',
      role: body.role ?? '',
    })

    return NextResponse.json(request, { status: 201 })
  } catch (error) {
    if (error instanceof InviteFlowError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)
    return NextResponse.json({ error: 'Failed to create access request.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!user.companyId || !user.id || user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as {
      requestId?: string
      action?: 'APPROVE' | 'REJECT'
      ttlHours?: number
    }

    const result = await reviewCompanyAccessRequest({
      requestId: body.requestId ?? '',
      action: body.action ?? 'REJECT',
      reviewerId: user.id,
      reviewerRole: user.role ?? 'EMPLOYEE',
      companyId: user.companyId,
      ttlHours: body.ttlHours,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof InviteFlowError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)
    return NextResponse.json({ error: 'Failed to review access request.' }, { status: 500 })
  }
}
