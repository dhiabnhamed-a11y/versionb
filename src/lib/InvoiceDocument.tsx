import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatInvoiceMoney, getInvoiceStatusLabel } from '@/lib/invoices'
import type { PdfInvoice, PdfInvoiceItem } from '@/lib/invoice-pdf'

type InvoiceDocumentProps = {
  invoice: PdfInvoice
}

const styles = StyleSheet.create({
  page: {
    padding: 42,
    backgroundColor: '#ffffff',
    color: '#172033',
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.45,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: '#dbe3ed',
    borderBottomStyle: 'solid',
  },
  brand: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    lineHeight: 1.05,
  },
  invoiceNumber: {
    marginTop: 7,
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  badge: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderStyle: 'solid',
    backgroundColor: '#eff6ff',
    color: '#075985',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 22,
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
    width: 220,
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
  pageNumber: {
    position: 'absolute',
    bottom: 22,
    right: 42,
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
        <View style={styles.header} wrap={false}>
          <View>
            <Text style={styles.brand}>TASKIT</Text>
            <Text style={styles.title}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          </View>
          <Text style={styles.badge}>{status}</Text>
        </View>

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

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}
