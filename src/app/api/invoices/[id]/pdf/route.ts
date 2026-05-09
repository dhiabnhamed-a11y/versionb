import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { serializeInvoice } from '@/lib/invoices'

export const runtime = 'nodejs'

type SessionUser = {
  role?: string | null
  companyId?: string | null
}

function canManageInvoices(user: SessionUser) {
  return user.role === 'OWNER' || user.role === 'MANAGER'
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (!canManageInvoices(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      company: { select: { name: true, country: true, registrationNumber: true } },
      createdBy: { select: { name: true, email: true } },
      client: { select: { companyName: true, contactPerson: true, email: true, address: true, avatarUrl: true } },
      campaign: { select: { title: true } },
      brief: { select: { title: true } },
      items: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })

  const serializedInvoice = serializeInvoice(invoice) as unknown as Parameters<typeof generateInvoicePdf>[0]
  const pdf = await generateInvoicePdf(serializedInvoice)
  return new Response(pdf as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
