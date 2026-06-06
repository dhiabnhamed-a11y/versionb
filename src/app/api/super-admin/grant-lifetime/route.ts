import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedSuperAdminIdentity } from '@/lib/security'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user.id || !isAuthorizedSuperAdminIdentity(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as { companyId?: string }

    if (!body.companyId) {
      return NextResponse.json({ error: 'companyId is required.' }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { id: body.companyId },
      select: { id: true, status: true, planType: true },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 })
    }

    if (company.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Only active companies can receive lifetime grants.' }, { status: 400 })
    }

    if (company.planType === 'LIFETIME') {
      return NextResponse.json({ error: 'Company already has a lifetime subscription.' }, { status: 409 })
    }

    await prisma.company.update({
      where: { id: body.companyId },
      data: {
        planType: 'LIFETIME',
        subscriptionStatus: 'ACTIVE',
        billingInterval: 'LIFETIME',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to grant lifetime subscription.' }, { status: 500 })
  }
}
