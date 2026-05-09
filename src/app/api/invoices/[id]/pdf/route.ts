import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDatabaseConfigHint, prisma } from '@/lib/db'
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

function jsonHeaders(reqId: string) {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Request-Id': reqId,
    'Access-Control-Expose-Headers': 'X-Request-Id',
  }
}

const PDF_SIGNATURE = '%PDF-'

function assertPdf(pdf: Uint8Array) {
  const signature = Buffer.from(pdf.slice(0, 5)).toString('ascii')
  if (pdf.byteLength < 5 || signature !== PDF_SIGNATURE) {
    throw new Error(`PDF renderer returned invalid output. byteLength=${pdf.byteLength} signature=${signature}`)
  }
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
      code: 'code' in error ? error.code : undefined,
      stack: error.stack,
    }
  }

  return { message: String(error) }
}

function log(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown>) {
  const payload = { scope: 'invoice-pdf-route', ...meta }
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
      headers: jsonHeaders(reqId),
    }
  )
}

function logAndReturnJsonError(message: string, status: number, reqId: string, meta: Record<string, unknown>) {
  log(status >= 500 ? 'error' : 'warn', 'Invoice PDF request returned JSON error.', {
    requestId: reqId,
    status,
    ...meta,
  })

  return jsonError(message, status, reqId)
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
  assertPdf(pdf)
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
  let phase = 'route-params'

  try {
    invoiceId = await routeParams(context)
    if (!invoiceId) {
      return logAndReturnJsonError('Invoice id is required.', 400, reqId, {
        phase,
        durationMs: Date.now() - startedAt,
      })
    }

    log('info', 'Invoice PDF request started.', {
      requestId: reqId,
      invoiceId,
      accept: req.headers.get('accept'),
    })

    phase = 'auth'
    const session = await auth()
    if (!session) {
      return logAndReturnJsonError('Unauthorized', 401, reqId, {
        phase,
        invoiceId,
        durationMs: Date.now() - startedAt,
      })
    }

    const user = session.user as SessionUser
    if (!user.companyId) {
      return logAndReturnJsonError('No company found for this account.', 400, reqId, {
        phase,
        invoiceId,
        durationMs: Date.now() - startedAt,
      })
    }
    if (!canManageInvoices(user)) {
      return logAndReturnJsonError('Forbidden', 403, reqId, {
        phase,
        invoiceId,
        companyId: user.companyId,
        role: user.role,
        durationMs: Date.now() - startedAt,
      })
    }
    if (req.signal.aborted) {
      return logAndReturnJsonError('PDF request was cancelled.', 499, reqId, {
        phase,
        invoiceId,
        companyId: user.companyId,
        durationMs: Date.now() - startedAt,
      })
    }

    phase = 'load-invoice'
    const invoice = await loadInvoice(invoiceId, user.companyId)
    if (!invoice) {
      return logAndReturnJsonError('Invoice not found.', 404, reqId, {
        phase,
        invoiceId,
        companyId: user.companyId,
        durationMs: Date.now() - startedAt,
      })
    }

    phase = 'normalize-invoice'
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

    phase = 'generate-pdf'
    const pdf = await generateInvoicePdf(pdfInvoice, {
      requestId: reqId,
      invoiceId,
      invoiceNumber,
      startedAt,
    })

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
      phase,
      durationMs: Date.now() - startedAt,
      error: errorDetails(error),
      databaseHint: phase === 'load-invoice' ? getDatabaseConfigHint() : undefined,
    })

    return jsonError('Invoice PDF could not be generated right now. Please try again in a moment.', 503, reqId)
  }
}
