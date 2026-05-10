import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatInvoiceMoney, getInvoiceStatusLabel } from '@/lib/invoices'
import type { PdfInvoice, PdfInvoiceItem } from '@/lib/invoice-pdf'

type InvoiceDocumentProps = {
  invoice: PdfInvoice
}

const styles = StyleSheet.create({
  page: {
    padding: 34,
    backgroundColor: '#f4f7fb',
    color: '#172033',
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.45,
  },
  sheet: {
    minHeight: '100%',
    padding: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe3ed',
    borderStyle: 'solid',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 26,
    paddingHorizontal: 28,
    paddingBottom: 24,
    backgroundColor: '#172033',
    color: '#ffffff',
  },
  accentBar: {
    height: 7,
    backgroundColor: '#0ea5e9',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  brandMark: {
    width: 24,
    height: 24,
    marginRight: 9,
    backgroundColor: '#0ea5e9',
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingTop: 4,
  },
  brand: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#cbd5e1',
    textTransform: 'uppercase',
  },
  brandSub: {
    marginTop: 2,
    color: '#94a3b8',
    fontSize: 8,
  },
  title: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    lineHeight: 1.05,
  },
  invoiceNumber: {
    marginTop: 8,
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  headerMeta: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#e0f2fe',
    color: '#075985',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  headerMetaLabel: {
    marginTop: 18,
    color: '#94a3b8',
    fontSize: 8,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },
  headerMetaValue: {
    marginTop: 4,
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 30,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 14,
  },
  panel: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
    backgroundColor: '#f8fafc',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  label: {
    marginBottom: 6,
    color: '#64748b',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  name: {
    color: '#172033',
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  muted: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 9,
  },
  table: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#172033',
    color: '#ffffff',
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderTopStyle: 'solid',
    minHeight: 34,
  },
  cell: {
    paddingVertical: 9,
    paddingHorizontal: 8,
    fontSize: 9,
  },
  headCell: {
    paddingVertical: 9,
    paddingHorizontal: 8,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  descriptionCell: {
    width: '48%',
  },
  qtyCell: {
    width: '12%',
    textAlign: 'right',
  },
  moneyCell: {
    width: '20%',
    textAlign: 'right',
  },
  amountCell: {
    width: '20%',
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },
  totalsWrap: {
    marginTop: 20,
    marginLeft: 'auto',
    width: 240,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    color: '#475569',
  },
  totalValue: {
    fontFamily: 'Helvetica-Bold',
    color: '#172033',
  },
  grandTotal: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#172033',
    borderTopStyle: 'solid',
    color: '#111827',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 24,
  },
  signatureSection: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 14,
  },
  signatureCard: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'solid',
    backgroundColor: '#ffffff',
  },
  signatureText: {
    marginTop: 16,
    fontFamily: 'Helvetica-Oblique',
    fontSize: 19,
    color: '#172033',
  },
  signatureLine: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#172033',
    borderTopStyle: 'solid',
    paddingTop: 6,
  },
  signatureName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#172033',
  },
  signatureRole: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 8,
  },
  identityNote: {
    flex: 1,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderStyle: 'solid',
  },
  identityTitle: {
    color: '#075985',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  identityCopy: {
    marginTop: 8,
    color: '#334155',
    fontSize: 9,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 22,
    right: 42,
    color: '#94a3b8',
    fontSize: 8,
  },
  footerBrand: {
    position: 'absolute',
    bottom: 22,
    left: 42,
    color: '#94a3b8',
    fontSize: 8,
  },
})

function normalizeDate(value: Date | string | null | undefined) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  if (typeof value === 'string') {
    const date = new Date(value)
    if (Number.isFinite(date.getTime())) return date
  }
  return null
}

function formatDate(value: Date | string | null | undefined, locale: string) {
  const date = normalizeDate(value)
  if (!date) return 'Not set'

  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatQuantity(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-TN' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

function money(value: number, invoice: PdfInvoice) {
  return formatInvoiceMoney(value, invoice.currency, invoice.locale)
}

function initials(value: string) {
  const letters = value
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return letters || 'T'
}

function DetailPanel({
  label,
  title,
  lines,
}: {
  label: string
  title: string
  lines?: Array<string | null | undefined>
}) {
  const visibleLines = (lines ?? []).filter(Boolean)

  return (
    <View style={styles.panel} wrap={false}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.name}>{title}</Text>
      {visibleLines.length > 0 && <Text style={styles.muted}>{visibleLines.join('\n')}</Text>}
    </View>
  )
}

function InvoiceTableRow({ item, invoice }: { item: PdfInvoiceItem; invoice: PdfInvoice }) {
  return (
    <View style={styles.row} wrap={false}>
      <Text style={[styles.cell, styles.descriptionCell]}>{item.description}</Text>
      <Text style={[styles.cell, styles.qtyCell]}>{formatQuantity(item.quantity, invoice.locale)}</Text>
      <Text style={[styles.cell, styles.moneyCell]}>{money(item.unitPrice, invoice)}</Text>
      <Text style={[styles.cell, styles.amountCell]}>{money(item.lineTotal, invoice)}</Text>
    </View>
  )
}

export function InvoiceDocument({ invoice }: InvoiceDocumentProps) {
  const status = getInvoiceStatusLabel(invoice.status, invoice.locale)
  const items = invoice.items.length
    ? invoice.items
    : [{ description: 'No invoice items', quantity: 0, unitPrice: 0, lineTotal: 0 }]

  return (
    <Document
      title={`Invoice ${invoice.invoiceNumber}`}
      author={invoice.company.name}
      subject={`Invoice ${invoice.invoiceNumber}`}
      creator="TASKIT"
      producer="TASKIT"
      language={invoice.locale === 'ar' ? 'ar-TN' : 'en-US'}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.sheet}>
          <View style={styles.accentBar} />
          <View style={styles.header} wrap={false}>
            <View>
              <View style={styles.brandRow}>
                <Text style={styles.brandMark}>{initials(invoice.company.name)}</Text>
                <View>
                  <Text style={styles.brand}>{invoice.company.name}</Text>
                  <Text style={styles.brandSub}>Professional services invoice</Text>
                </View>
              </View>
              <Text style={styles.title}>Invoice</Text>
              <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.badge}>{status}</Text>
              <Text style={styles.headerMetaLabel}>Amount due</Text>
              <Text style={styles.headerMetaValue}>{money(invoice.total, invoice)}</Text>
              <Text style={styles.headerMetaLabel}>Due date</Text>
              <Text style={styles.headerMetaValue}>{formatDate(invoice.dueDate, invoice.locale)}</Text>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.twoColumn} wrap={false}>
              <DetailPanel
                label="From"
                title={invoice.company.name}
                lines={[invoice.company.country, invoice.company.registrationNumber]}
              />
              <DetailPanel
                label="Bill to"
                title={invoice.clientName}
                lines={[invoice.clientEmail, invoice.clientAddress]}
              />
            </View>

            <View style={styles.metaGrid} wrap={false}>
              <DetailPanel label="Issue date" title={formatDate(invoice.issueDate, invoice.locale)} />
              <DetailPanel label="Due date" title={formatDate(invoice.dueDate, invoice.locale)} />
              <DetailPanel label="Status" title={status} />
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader} wrap={false}>
                <Text style={[styles.headCell, styles.descriptionCell]}>Description</Text>
                <Text style={[styles.headCell, styles.qtyCell]}>Qty</Text>
                <Text style={[styles.headCell, styles.moneyCell]}>Unit price</Text>
                <Text style={[styles.headCell, styles.amountCell]}>Amount</Text>
              </View>
              {items.map((item, index) => (
                <InvoiceTableRow key={`${item.description}-${index}`} item={item} invoice={invoice} />
              ))}
            </View>

            <View style={styles.totalsWrap} wrap={false}>
              <View style={styles.totalRow}>
                <Text>Subtotal</Text>
                <Text style={styles.totalValue}>{money(invoice.subtotal, invoice)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text>Tax ({invoice.taxRate.toFixed(2)}%)</Text>
                <Text style={styles.totalValue}>{money(invoice.taxTotal, invoice)}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotal]}>
                <Text>Total</Text>
                <Text>{money(invoice.total, invoice)}</Text>
              </View>
            </View>

            <View style={styles.footer} wrap={false}>
              <DetailPanel label="Notes" title={invoice.notes || 'Thank you for your business.'} />
              <DetailPanel label="Prepared by" title={invoice.createdBy.name} lines={[invoice.createdBy.email]} />
            </View>

            <View style={styles.signatureSection} wrap={false}>
              <View style={styles.signatureCard}>
                <Text style={styles.label}>Authorized signature</Text>
                <Text style={styles.signatureText}>{invoice.createdBy.name}</Text>
                <View style={styles.signatureLine}>
                  <Text style={styles.signatureName}>{invoice.createdBy.name}</Text>
                  <Text style={styles.signatureRole}>For {invoice.company.name}</Text>
                </View>
              </View>
              <View style={styles.identityNote}>
                <Text style={styles.identityTitle}>Professional identity</Text>
                <Text style={styles.identityCopy}>
                  This invoice was prepared and authorized by {invoice.company.name}. Please reference invoice {invoice.invoiceNumber} with any payment or billing correspondence.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.footerBrand} fixed>
          {invoice.company.name} / {invoice.invoiceNumber}
        </Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}
