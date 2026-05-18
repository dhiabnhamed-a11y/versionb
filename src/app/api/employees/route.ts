import { NextResponse } from 'next/server'
import { withLegacyApiGuard } from '@/lib/api/legacy-guard'
import { prisma } from '@/lib/db'
import { createCompanyInvite, getInviteTtlHours, InviteFlowError } from '@/lib/invites'

export async function GET(req: Request) {
  return withLegacyApiGuard(req, async (user) => {
    if (user.role === 'EMPLOYEE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!user.companyId) return NextResponse.json([])

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
  })
}

export async function POST(req: Request) {
  return withLegacyApiGuard(req, async (user) => {
    try {
      if (!user.companyId) {
        return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
      }
      if (user.role === 'EMPLOYEE') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { email, role, ttlHours } = (await req.json()) as { email: string; role?: string; ttlHours?: number }
      const invite = await createCompanyInvite({
        companyId: user.companyId,
        companyAdminId: user.id,
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
  })
}
