import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createCompanyInvite, getInviteTtlHours, InviteFlowError } from '@/lib/invites'

type SessionUser = {
  role?: string
  companyId?: string | null
}

// GET employees for this company
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) {
    return NextResponse.json([])
  }

  try {
    const employees = await prisma.user.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        assignedTasks: {
          select: { id: true, stage: true, priority: true, deadline: true },
        },
        activities: {
          select: { id: true, action: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
    return NextResponse.json(employees)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST add employee to company
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) {
    return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  }
  if (!('id' in session.user) || user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { email, role, ttlHours } = (await req.json()) as { email: string; role?: string; ttlHours?: number }

    const invite = await createCompanyInvite({
      companyId: user.companyId,
      companyAdminId: session.user.id,
      companyAdminRole: user.role ?? 'EMPLOYEE',
      email,
      role: role || 'EMPLOYEE',
      ttlHours: ttlHours ?? getInviteTtlHours(),
    })

    return NextResponse.json(invite, { status: 201 })
  } catch (err) {
    if (err instanceof InviteFlowError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }

    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
