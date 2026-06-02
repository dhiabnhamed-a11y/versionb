import { NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireSessionUser()
    if (!user.companyId) return NextResponse.json({ value: 0, currency: 'USD', label: 'No data yet' })

    const count = await prisma.budget.count({
      where: { companyId: user.companyId, status: { in: ['ACTIVE', 'DRAFT'] } },
    })

    return NextResponse.json({ value: count, label: 'Active Budgets' })
  } catch {
    return NextResponse.json({ value: 0, label: 'No data yet' })
  }
}
