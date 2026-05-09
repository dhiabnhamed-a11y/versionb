import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { InvoiceDocument } from '@/lib/InvoiceDocument'

export type PdfInvoiceItem = {
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type PdfInvoice = {
  invoiceNumber: string
  status: string
  currency: string
  locale: string
  issueDate: Date | string
  dueDate?: Date | string | null
  clientName: string
  clientEmail?: string | null
  clientAddress?: string | null
  notes?: string | null
  subtotal: number
  taxRate: number
  taxTotal: number
  total: number
  company: {
    name: string
    country?: string | null
    registrationNumber?: string | null
  }
  createdBy: {
    name: string
    email: string
  }
  items: PdfInvoiceItem[]
}

export type InvoicePdfLogContext = {
  requestId?: string
  invoiceId?: string
  invoiceNumber?: string
  startedAt?: number
}

type RawPdfInvoice = Partial<PdfInvoice> & Record<string, unknown>

const PDF_SIGNATURE = '%PDF-'

function toFiniteNumber(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(String(value ?? 0).replace(',', '.'))
  return Number.isFinite(amount) ? amount : 0
}

function safeText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function safeInvoiceNumber(value: unknown) {
  return safeText(value, 'invoice')
}

function safeCurrency(value: unknown) {
  const currency = safeText(value, 'USD').toUpperCase()
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
}

function invoiceLocale(value: unknown) {
  return value === 'ar' ? 'ar' : 'en'
}

function normalizeDate(value: unknown, fallback: Date | null) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (Number.isFinite(date.getTime())) return date
  }
  return fallback
}

function relationObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function normalizeItems(value: unknown): PdfInvoiceItem[] {
  if (!Array.isArray(value)) return []

  return value.map((item) => {
    const row = relationObject(item)
    const quantity = Math.max(toFiniteNumber(row.quantity), 0)
    const unitPrice = Math.max(toFiniteNumber(row.unitPrice), 0)
    const lineTotal = Math.max(toFiniteNumber(row.lineTotal) || quantity * unitPrice, 0)

    return {
      description: safeText(row.description, '-'),
      quantity,
      unitPrice,
      lineTotal,
    }
  })
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

function logPdfEvent(level: 'info' | 'warn' | 'error', event: string, context: InvoicePdfLogContext, meta: Record<string, unknown> = {}) {
  const payload = {
    scope: 'invoice-pdf-renderer',
    renderer: '@react-pdf/renderer',
    event,
    requestId: context.requestId,
    invoiceId: context.invoiceId,
    invoiceNumber: context.invoiceNumber,
    durationMs: context.startedAt ? Date.now() - context.startedAt : undefined,
    ...meta,
  }

  if (level === 'error') console.error('[invoice-pdf-renderer]', payload)
  else if (level === 'warn') console.warn('[invoice-pdf-renderer]', payload)
  else console.info('[invoice-pdf-renderer]', payload)
}

function assertPdfBuffer(pdf: Uint8Array) {
  const signature = Buffer.from(pdf.slice(0, 5)).toString('ascii')
  if (pdf.byteLength < 5 || signature !== PDF_SIGNATURE) {
    throw new Error(`React PDF renderer returned invalid output. byteLength=${pdf.byteLength} signature=${signature}`)
  }
}

export function normalizePdfInvoice(invoice: RawPdfInvoice): PdfInvoice {
  const company = relationObject(invoice.company)
  const createdBy = relationObject(invoice.createdBy)
  const client = relationObject(invoice.client)
  const locale = invoiceLocale(invoice.locale)
  const items = normalizeItems(invoice.items)
  const clientName = safeText(invoice.clientName, safeText(client.companyName, 'Client'))

  return {
    invoiceNumber: safeInvoiceNumber(invoice.invoiceNumber),
    status: safeText(invoice.status, 'draft'),
    currency: safeCurrency(invoice.currency),
    locale,
    issueDate: normalizeDate(invoice.issueDate, new Date()) ?? new Date(),
    dueDate: normalizeDate(invoice.dueDate, null),
    clientName,
    clientEmail: safeText(invoice.clientEmail, safeText(client.email)) || null,
    clientAddress: safeText(invoice.clientAddress, safeText(client.address)) || null,
    notes: safeText(invoice.notes) || null,
    subtotal: toFiniteNumber(invoice.subtotal),
    taxRate: toFiniteNumber(invoice.taxRate),
    taxTotal: toFiniteNumber(invoice.taxTotal),
    total: toFiniteNumber(invoice.total),
    company: {
      name: safeText(company.name, 'TASKIT'),
      country: safeText(company.country) || null,
      registrationNumber: safeText(company.registrationNumber) || null,
    },
    createdBy: {
      name: safeText(createdBy.name, 'TASKIT'),
      email: safeText(createdBy.email),
    },
    items,
  }
}

export function validateInvoiceForPdf(invoice: PdfInvoice) {
  const warnings: string[] = []
  if (!safeText(invoice.invoiceNumber)) warnings.push('invoiceNumber')
  if (!safeText(invoice.clientName)) warnings.push('clientName')
  if (!safeText(invoice.company?.name)) warnings.push('company.name')
  if (!Array.isArray(invoice.items)) warnings.push('items')
  if (Array.isArray(invoice.items) && invoice.items.length === 0) warnings.push('items.empty')
  return warnings
}

export async function generateInvoicePdf(rawInvoice: PdfInvoice, context: InvoicePdfLogContext = {}) {
  const invoice = normalizePdfInvoice(rawInvoice)
  const logContext = {
    ...context,
    invoiceNumber: context.invoiceNumber ?? invoice.invoiceNumber,
    startedAt: context.startedAt ?? Date.now(),
  }
  const warnings = validateInvoiceForPdf(invoice)

  if (warnings.length > 0) {
    logPdfEvent('warn', 'invoice-normalized-with-warnings', logContext, { warnings })
  }

  try {
    logPdfEvent('info', 'pdf-render-started', logContext)
    const document = createElement(InvoiceDocument, { invoice }) as unknown as Parameters<typeof renderToBuffer>[0]
    const pdf = await renderToBuffer(document)
    assertPdfBuffer(pdf)
    logPdfEvent('info', 'pdf-render-completed', logContext, { byteLength: pdf.byteLength })
    return pdf
  } catch (error) {
    logPdfEvent('error', 'pdf-render-failed', logContext, { error: errorDetails(error) })
    throw error
  }
}
