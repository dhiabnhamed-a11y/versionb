import { NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireSessionUser()
    if (!user.companyId) return NextResponse.json({ value: 0, currency: 'USD' })

    const nextPayroll = await prisma.payroll.findFirst({
      where: { companyId: user.companyId, status: 'DRAFT' },
      orderBy: { createdAt: 'asc' },
      select: { netPay: true, currency: true },
    })

    return NextResponse.json({
      value: nextPayroll?.netPay?.toNumber() ?? 0,
      currency: nextPayroll?.currency ?? 'USD',
    })
  } catch {
    return NextResponse.json({ value: 0, currency: 'USD' })
  }
}
