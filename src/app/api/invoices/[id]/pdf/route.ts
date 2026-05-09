import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateInvoicePdf, normalizePdfInvoice, validateInvoiceForPdf, type PdfInvoice } from '@/lib/invoice-pdf'
import { serializeInvoice } from '@/lib/invoices'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SessionUser = {
  role?: string | null
  companyId?: string | null
}

type RouteCtx = {
  params: Promise<{ id?: string }>
}

const JSON_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `pdf_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function canManageInvoices(user: SessionUser) {
  return user.role === 'OWNER' || user.role === 'MANAGER'
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    }
  }

  return { message: String(error) }
}

function log(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown>) {
  const payload = { scope: 'invoice-pdf', ...meta }
  if (level === 'error') console.error(message, payload)
  else if (level === 'warn') console.warn(message, payload)
  else console.info(message, payload)
}

function jsonError(message: string, status: number, reqId: string) {
  return NextResponse.json(
    {
      error: message,
      requestId: reqId,
    },
    {
      status,
      headers: JSON_HEADERS,
    }
  )
}

function asciiFilename(value: string) {
  const base = value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+|_+$/g, '') || 'invoice'
  return base.slice(0, 120)
}

function downloadFilename(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'invoice'
  return `${cleaned.slice(0, 120)}.pdf`
}

function encodeRfc5987(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function pdfHeaders(invoiceNumber: string, byteLength: number) {
  const asciiName = `${asciiFilename(invoiceNumber)}.pdf`
  const utf8Name = downloadFilename(invoiceNumber)

  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeRfc5987(utf8Name)}`,
    'Content-Length': String(byteLength),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length, X-Request-Id',
  }
}

function pdfResponse(pdf: Uint8Array, invoiceNumber: string, reqId: string) {
  const body = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(body).set(pdf)

  return new Response(body, {
    status: 200,
    headers: {
      ...pdfHeaders(invoiceNumber, pdf.byteLength),
      'X-Request-Id': reqId,
    },
  })
}

async function routeParams(context: RouteCtx) {
  try {
    const params = await context.params
    return typeof params?.id === 'string' ? params.id.trim() : ''
  } catch {
    return ''
  }
}

async function loadInvoice(id: string, companyId: string) {
  return prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      company: { select: { name: true, country: true, registrationNumber: true } },
      createdBy: { select: { name: true, email: true } },
      client: { select: { companyName: true, contactPerson: true, email: true, address: true, avatarUrl: true } },
      campaign: { select: { title: true } },
      brief: { select: { title: true } },
      items: { orderBy: { createdAt: 'asc' } },
    },
  })
}

export async function GET(req: NextRequest, context: RouteCtx) {
  const reqId = requestId()
  const startedAt = Date.now()
  let invoiceId = ''

  try {
    invoiceId = await routeParams(context)
    if (!invoiceId) return jsonError('Invoice id is required.', 400, reqId)

    log('info', 'Invoice PDF request started.', {
      requestId: reqId,
      invoiceId,
      accept: req.headers.get('accept'),
    })

    const session = await auth()
    if (!session) return jsonError('Unauthorized', 401, reqId)

    const user = session.user as SessionUser
    if (!user.companyId) return jsonError('No company found for this account.', 400, reqId)
    if (!canManageInvoices(user)) return jsonError('Forbidden', 403, reqId)
    if (req.signal.aborted) return jsonError('PDF request was cancelled.', 499, reqId)

    const invoice = await loadInvoice(invoiceId, user.companyId)
    if (!invoice) return jsonError('Invoice not found.', 404, reqId)

    const serializedInvoice = serializeInvoice(invoice)
    const pdfInvoice = normalizePdfInvoice(serializedInvoice as unknown as PdfInvoice)
    const invoiceNumber = pdfInvoice.invoiceNumber || invoice.invoiceNumber || 'invoice'
    const warnings = validateInvoiceForPdf(pdfInvoice)

    if (warnings.length > 0) {
      log('warn', 'Invoice PDF request has incomplete data; normalized values will be used.', {
        requestId: reqId,
        invoiceId,
        invoiceNumber,
        warnings,
      })
    }

    const pdf = await generateInvoicePdf(pdfInvoice)

    log('info', 'Invoice PDF request completed.', {
      requestId: reqId,
      invoiceId,
      invoiceNumber,
      byteLength: pdf.byteLength,
      durationMs: Date.now() - startedAt,
    })

    return pdfResponse(pdf, invoiceNumber, reqId)
  } catch (error) {
    log('error', 'Invoice PDF request failed.', {
      requestId: reqId,
      invoiceId,
      durationMs: Date.now() - startedAt,
      error: errorDetails(error),
    })

    return jsonError('Invoice PDF could not be generated right now. Please try again in a moment.', 503, reqId)
  }
}
