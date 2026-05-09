import { formatInvoiceMoney, getInvoiceStatusLabel } from '@/lib/invoices'

type PdfInvoice = {
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
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(value: Date | string | null | undefined, locale: string) {
  if (!value) return locale === 'ar' ? 'غير محدد' : 'Not set'
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function renderInvoiceHtml(invoice: PdfInvoice) {
  const isArabic = invoice.locale === 'ar'
  const dir = isArabic ? 'rtl' : 'ltr'
  const copy = isArabic
    ? {
        invoice: 'فاتورة',
        billTo: 'فاتورة إلى',
        from: 'من',
        issueDate: 'تاريخ الإصدار',
        dueDate: 'تاريخ الاستحقاق',
        status: 'الحالة',
        description: 'الوصف',
        quantity: 'الكمية',
        unitPrice: 'سعر الوحدة',
        amount: 'المبلغ',
        subtotal: 'المجموع الفرعي',
        tax: 'الضريبة',
        total: 'الإجمالي',
        notes: 'ملاحظات',
        preparedBy: 'أعدها',
      }
    : {
        invoice: 'Invoice',
        billTo: 'Bill to',
        from: 'From',
        issueDate: 'Issue date',
        dueDate: 'Due date',
        status: 'Status',
        description: 'Description',
        quantity: 'Qty',
        unitPrice: 'Unit price',
        amount: 'Amount',
        subtotal: 'Subtotal',
        tax: 'Tax',
        total: 'Total',
        notes: 'Notes',
        preparedBy: 'Prepared by',
      }

  const rows = invoice.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.description)}</td>
          <td class="numeric">${item.quantity.toFixed(2)}</td>
          <td class="numeric">${formatInvoiceMoney(item.unitPrice, invoice.currency, invoice.locale)}</td>
          <td class="numeric">${formatInvoiceMoney(item.lineTotal, invoice.currency, invoice.locale)}</td>
        </tr>
      `
    )
    .join('')

  return `<!doctype html>
  <html lang="${isArabic ? 'ar' : 'en'}" dir="${dir}">
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 42px; color: #102033; font-family: Arial, "Helvetica Neue", sans-serif; background: #f7f8fa; }
        .paper { min-height: 100%; background: white; border: 1px solid #e2e7ee; border-radius: 18px; padding: 42px; }
        .top { display: flex; justify-content: space-between; gap: 32px; align-items: flex-start; border-bottom: 1px solid #e2e7ee; padding-bottom: 28px; }
        .brand { font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: .12em; font-weight: 700; }
        h1 { margin: 8px 0 0; font-size: 42px; line-height: 1; }
        .number { margin-top: 10px; color: #64748b; font-size: 14px; font-weight: 700; }
        .badge { display: inline-flex; border-radius: 999px; padding: 8px 14px; background: #edf7fb; color: #0369a1; font-size: 12px; font-weight: 800; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 30px; }
        .box { border: 1px solid #e2e7ee; border-radius: 14px; padding: 18px; background: #fbfcfd; }
        .label { color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 8px; }
        .name { font-size: 18px; font-weight: 800; }
        .muted { color: #64748b; font-size: 13px; line-height: 1.6; margin-top: 4px; white-space: pre-line; }
        .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 22px; }
        table { width: 100%; border-collapse: collapse; margin-top: 32px; }
        th { text-align: start; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid #dbe3ed; padding: 12px 10px; }
        td { border-bottom: 1px solid #edf1f5; padding: 14px 10px; font-size: 13px; vertical-align: top; }
        .numeric { text-align: end; white-space: nowrap; }
        .totals { width: 330px; margin-inline-start: auto; margin-top: 28px; }
        .total-row { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; font-size: 14px; color: #2e4060; }
        .grand { margin-top: 8px; border-top: 2px solid #102033; padding-top: 16px; color: #102033; font-size: 22px; font-weight: 900; }
        .footer { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 36px; }
        @page { size: A4; margin: 0; }
      </style>
    </head>
    <body>
      <main class="paper">
        <section class="top">
          <div>
            <div class="brand">TASKIT</div>
            <h1>${copy.invoice}</h1>
            <div class="number">${escapeHtml(invoice.invoiceNumber)}</div>
          </div>
          <div class="badge">${getInvoiceStatusLabel(invoice.status, invoice.locale)}</div>
        </section>

        <section class="grid">
          <div class="box">
            <div class="label">${copy.from}</div>
            <div class="name">${escapeHtml(invoice.company.name)}</div>
            <div class="muted">${escapeHtml(invoice.company.country ?? '')}${invoice.company.registrationNumber ? `<br/>${escapeHtml(invoice.company.registrationNumber)}` : ''}</div>
          </div>
          <div class="box">
            <div class="label">${copy.billTo}</div>
            <div class="name">${escapeHtml(invoice.clientName)}</div>
            <div class="muted">${escapeHtml(invoice.clientEmail ?? '')}${invoice.clientAddress ? `<br/>${escapeHtml(invoice.clientAddress)}` : ''}</div>
          </div>
        </section>

        <section class="meta">
          <div class="box"><div class="label">${copy.issueDate}</div><div class="name">${formatDate(invoice.issueDate, invoice.locale)}</div></div>
          <div class="box"><div class="label">${copy.dueDate}</div><div class="name">${formatDate(invoice.dueDate, invoice.locale)}</div></div>
          <div class="box"><div class="label">${copy.status}</div><div class="name">${getInvoiceStatusLabel(invoice.status, invoice.locale)}</div></div>
        </section>

        <table>
          <thead>
            <tr>
              <th>${copy.description}</th>
              <th class="numeric">${copy.quantity}</th>
              <th class="numeric">${copy.unitPrice}</th>
              <th class="numeric">${copy.amount}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <section class="totals">
          <div class="total-row"><span>${copy.subtotal}</span><strong>${formatInvoiceMoney(invoice.subtotal, invoice.currency, invoice.locale)}</strong></div>
          <div class="total-row"><span>${copy.tax} (${invoice.taxRate.toFixed(2)}%)</span><strong>${formatInvoiceMoney(invoice.taxTotal, invoice.currency, invoice.locale)}</strong></div>
          <div class="total-row grand"><span>${copy.total}</span><span>${formatInvoiceMoney(invoice.total, invoice.currency, invoice.locale)}</span></div>
        </section>

        <section class="footer">
          <div class="box">
            <div class="label">${copy.notes}</div>
            <div class="muted">${escapeHtml(invoice.notes || (isArabic ? 'شكرا لتعاملكم معنا.' : 'Thank you for your business.'))}</div>
          </div>
          <div class="box">
            <div class="label">${copy.preparedBy}</div>
            <div class="name">${escapeHtml(invoice.createdBy.name)}</div>
            <div class="muted">${escapeHtml(invoice.createdBy.email)}</div>
          </div>
        </section>
      </main>
    </body>
  </html>`
}

async function launchPdfBrowser() {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)

  if (isServerless) {
    const [{ default: chromium }, puppeteer] = await Promise.all([import('@sparticuz/chromium'), import('puppeteer-core')])
    const executablePath = await chromium.executablePath()

    return puppeteer.default.launch({
      args: [...chromium.args, '--disable-dev-shm-usage', '--disable-gpu'],
      defaultViewport: { width: 1240, height: 1754 },
      executablePath,
      headless: true,
    })
  }

  const puppeteer = await import('puppeteer')
  return puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
}

export async function generateInvoicePdf(invoice: PdfInvoice) {
  const browser = await launchPdfBrowser()

  try {
    const page = await browser.newPage()
    await page.setContent(renderInvoiceHtml(invoice), { waitUntil: 'networkidle0' })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    })
  } finally {
    await browser.close()
  }
}
