import { NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
try {
const user = await requireSessionUser()
if (!user.companyId) return NextResponse.json({ value: 0, currency: 'USD' })

const result = await prisma.ledger.aggregate({
  where: {
    companyId: user.companyId,
    account: { type: { in: ['ASSET'] }, code: { startsWith: '12' } },
  },
  _sum: { debit: true, credit: true },
})

const total = (result._sum?.debit?.toNumber() ?? 0) - (result._sum?.credit?.toNumber() ?? 0)
return NextResponse.json({ value: Math.max(0, total), currency: 'USD' })
} catch {
return NextResponse.json({ value: 0, currency: 'USD' })
}
}, { auth: 'required' });
