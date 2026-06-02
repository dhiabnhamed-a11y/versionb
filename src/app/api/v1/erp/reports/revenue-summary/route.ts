import { NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireSessionUser()
    if (!user.companyId) return NextResponse.json({ value: 0, currency: 'USD' })

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const result = await prisma.ledger.aggregate({
      where: {
        companyId: user.companyId,
        account: { type: { in: ['REVENUE'] } },
        createdAt: { gte: startOfMonth },
      },
      _sum: { credit: true, debit: true },
    })

    const total = (result._sum?.credit?.toNumber() ?? 0) - (result._sum?.debit?.toNumber() ?? 0)
    return NextResponse.json({ value: Math.max(0, total), currency: 'USD' })
  } catch {
    return NextResponse.json({ value: 0, currency: 'USD' })
  }
}
