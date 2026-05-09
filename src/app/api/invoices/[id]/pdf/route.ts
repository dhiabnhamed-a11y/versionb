import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateFallbackInvoicePdf, generateInvoicePdf, type PdfInvoice } from '@/lib/invoice-pdf'
import { serializeInvoice } from '@/lib/invoices'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SessionUser = {
  role?: string | null
  companyId?: string | null
}

function canManageInvoices(user: SessionUser) {
  return user.role === 'OWNER' || user.role === 'MANAGER'
}

function pdfHeaders(invoiceNumber: string, byteLength: number) {
  const safeName = invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, '_') || 'invoice'
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
    'Content-Length': String(byteLength),
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  }
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

  const serializedInvoice = serializeInvoice(invoice) as unknown as PdfInvoice
  const invoiceNumber = serializedInvoice.invoiceNumber || invoice.invoiceNumber || 'invoice'

  try {
    const pdf = await generateInvoicePdf(serializedInvoice)
    return new Response(pdf as BodyInit, {
      headers: pdfHeaders(invoiceNumber, pdf.byteLength),
    })
  } catch (error) {
    console.error('Invoice PDF generation failed catastrophically; returning fallback PDF.', {
      invoiceId: invoice.id,
      invoiceNumber,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    })

    try {
      const fallback = await generateFallbackInvoicePdf(serializedInvoice, error)
      return new Response(fallback as BodyInit, {
        headers: pdfHeaders(invoiceNumber, fallback.byteLength),
      })
    } catch (fallbackError) {
      console.error('Invoice fallback PDF generation failed.', {
        invoiceId: invoice.id,
        invoiceNumber,
        error: fallbackError instanceof Error ? { name: fallbackError.name, message: fallbackError.message, stack: fallbackError.stack } : fallbackError,
      })
      return NextResponse.json({ error: 'Invoice PDF could not be generated. Please contact support.' }, { status: 500 })
    }
  }
}
