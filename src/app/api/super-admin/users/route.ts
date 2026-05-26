import { NextRequest, NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { isAuthorizedSuperAdminIdentity } from '@/lib/security'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const actor = await requireSessionUser()
  if (!actor.id || !isAuthorizedSuperAdminIdentity(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query') ?? ''

    const where: Record<string, unknown> = {}
    if (query.trim()) {
      where.OR = [
        { name: { contains: query.trim(), mode: 'insensitive' } },
        { email: { contains: query.trim(), mode: 'insensitive' } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        createdAt: true,
        companyId: true,
        company: { select: { name: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Failed to load users:', error)
    return NextResponse.json({ error: 'Failed to load users.' }, { status: 500 })
  }
}
