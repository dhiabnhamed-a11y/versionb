export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export type InvoiceItemInput = {
  description?: unknown
  quantity?: unknown
  unitPrice?: unknown
}

export type InvoiceTotals = {
  subtotalCents: number
  taxTotalCents: number
  totalCents: number
  taxRate: number
  items: Array<{
    description: string
    quantity: number
    unitPriceCents: number
    lineTotalCents: number
  }>
}

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return typeof value === 'string' && INVOICE_STATUSES.includes(value as InvoiceStatus)
}

export function normalizeInvoiceLocale(value: unknown) {
  return value === 'ar' ? 'ar' : 'en'
}

export function normalizeCurrency(value: unknown) {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(number) ? number : fallback
}

export function parseMoneyToCents(value: unknown) {
  return Math.round(toFiniteNumber(value) * 100)
}

export function centsToDecimal(cents: number) {
  return (cents / 100).toFixed(2)
}

export function centsToMoney(cents: number) {
  return (cents / 100).toFixed(2)
}

export function decimalToNumber(value: { toString(): string } | number | string | null | undefined) {
  if (value == null) return 0
  return Number(value.toString())
}

export function calculateInvoiceTotals(rawItems: InvoiceItemInput[], rawTaxRate: unknown): InvoiceTotals {
  const taxRate = Math.min(Math.max(toFiniteNumber(rawTaxRate), 0), 100)
  const items = rawItems
    .map((item) => {
      const description = typeof item.description === 'string' ? item.description.trim() : ''
      const quantity = Math.max(toFiniteNumber(item.quantity, 1), 0)
      const unitPriceCents = Math.max(parseMoneyToCents(item.unitPrice), 0)
      const lineTotalCents = Math.round(quantity * unitPriceCents)

      return {
        description,
        quantity,
        unitPriceCents,
        lineTotalCents,
      }
    })
    .filter((item) => item.description && item.quantity > 0)

  const subtotalCents = items.reduce((total, item) => total + item.lineTotalCents, 0)
  const taxTotalCents = Math.round(subtotalCents * (taxRate / 100))
  const totalCents = subtotalCents + taxTotalCents

  return {
    subtotalCents,
    taxTotalCents,
    totalCents,
    taxRate,
    items,
  }
}

export function formatInvoiceMoney(value: number | string, currency: string, locale = 'en') {
  const amount = typeof value === 'number' ? value : Number(value)
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-TN' : 'en-US', {
    style: 'currency',
    currency: normalizeCurrency(currency),
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function getInvoiceStatusLabel(status: string, locale = 'en') {
  const labels: Record<InvoiceStatus, { en: string; ar: string }> = {
    draft: { en: 'Draft', ar: 'مسودة' },
    sent: { en: 'Sent', ar: 'مرسلة' },
    paid: { en: 'Paid', ar: 'مدفوعة' },
    overdue: { en: 'Overdue', ar: 'متأخرة' },
  }

  return labels[isInvoiceStatus(status) ? status : 'draft'][locale === 'ar' ? 'ar' : 'en']
}

export function serializeInvoice<T extends { items?: unknown[]; subtotal?: unknown; taxTotal?: unknown; total?: unknown; taxRate?: unknown }>(
  invoice: T
) {
  return {
    ...invoice,
    taxRate: decimalToNumber(invoice.taxRate as { toString(): string }),
    subtotal: decimalToNumber(invoice.subtotal as { toString(): string }),
    taxTotal: decimalToNumber(invoice.taxTotal as { toString(): string }),
    total: decimalToNumber(invoice.total as { toString(): string }),
    items: Array.isArray(invoice.items)
      ? invoice.items.map((item) => {
          const row = item as Record<string, unknown>
          return {
            ...row,
            quantity: decimalToNumber(row.quantity as { toString(): string }),
            unitPrice: decimalToNumber(row.unitPrice as { toString(): string }),
            lineTotal: decimalToNumber(row.lineTotal as { toString(): string }),
          }
        })
      : [],
  }
}
