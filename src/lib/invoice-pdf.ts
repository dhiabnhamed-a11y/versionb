import { formatInvoiceMoney, getInvoiceStatusLabel } from '@/lib/invoices'

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
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
}

type RawPdfInvoice = Partial<PdfInvoice> & Record<string, unknown>
type PdfBrowser = Awaited<ReturnType<typeof launchPdfBrowser>>

let chromiumExecutablePathPromise: Promise<string> | null = null
let arabicFontCssPromise: Promise<string> | null = null

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

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

function invoiceCopy(locale: string) {
  return locale === 'ar'
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
        notSet: 'غير محدد',
        noItems: 'لا توجد عناصر',
        thankYou: 'شكرا لتعاملكم معنا.',
        fallbackNote: 'تم إنشاء هذه النسخة المبسطة لأن خدمة PDF المتقدمة غير متاحة مؤقتا.',
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
        notSet: 'Not set',
        noItems: 'No invoice items',
        thankYou: 'Thank you for your business.',
        fallbackNote: 'This simplified PDF was generated because the advanced PDF service is temporarily unavailable.',
      }
}

function normalizeDate(value: unknown, fallback: Date | null) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (Number.isFinite(date.getTime())) return date
  }
  return fallback
}

function formatDate(value: Date | string | null | undefined, locale: string) {
  const date = normalizeDate(value, null)
  if (!date) return invoiceCopy(locale).notSet

  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function relationObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function normalizeItems(value: unknown): PdfInvoice['items'] {
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

export function normalizePdfInvoice(invoice: RawPdfInvoice): PdfInvoice {
  const company = relationObject(invoice.company)
  const createdBy = relationObject(invoice.createdBy)
  const client = relationObject(invoice.client)
  const locale = invoiceLocale(invoice.locale)
  const items = normalizeItems(invoice.items)
  const clientName = safeText(invoice.clientName, safeText(client.companyName, locale === 'ar' ? 'العميل' : 'Client'))

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

async function getArabicFontCss() {
  arabicFontCssPromise ??= (async () => {
    const { readFile } = await import('node:fs/promises')
    const { createRequire } = await import('node:module')
    const require = createRequire(import.meta.url)
    const [regularPath, boldPath] = [
      require.resolve('@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff2'),
      require.resolve('@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff2'),
    ]
    const [regular, bold] = await Promise.all([readFile(regularPath), readFile(boldPath)])

    return `
      @font-face {
        font-family: "TaskitArabic";
        src: url(data:font/woff2;base64,${regular.toString('base64')}) format("woff2");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: "TaskitArabic";
        src: url(data:font/woff2;base64,${bold.toString('base64')}) format("woff2");
        font-weight: 700 900;
        font-style: normal;
        font-display: swap;
      }
    `
  })()

  return arabicFontCssPromise
}

async function renderInvoiceHtml(rawInvoice: PdfInvoice) {
  const invoice = normalizePdfInvoice(rawInvoice)
  const locale = invoiceLocale(invoice.locale)
  const isArabic = locale === 'ar'
  const dir = isArabic ? 'rtl' : 'ltr'
  const copy = invoiceCopy(locale)
  const arabicFontCss = isArabic ? await getArabicFontCss() : ''
  const rows = invoice.items.length
    ? invoice.items
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.description)}</td>
              <td class="numeric">${toFiniteNumber(item.quantity).toFixed(2)}</td>
              <td class="numeric">${escapeHtml(formatInvoiceMoney(item.unitPrice, invoice.currency, locale))}</td>
              <td class="numeric">${escapeHtml(formatInvoiceMoney(item.lineTotal, invoice.currency, locale))}</td>
            </tr>
          `
        )
        .join('')
    : `<tr><td colspan="4" class="empty">${copy.noItems}</td></tr>`

  return `<!doctype html>
  <html lang="${isArabic ? 'ar' : 'en'}" dir="${dir}">
    <head>
      <meta charset="utf-8" />
      <style>
        ${arabicFontCss}
        * { box-sizing: border-box; }
        html, body { min-height: 100%; }
        body {
          margin: 0;
          padding: 36px;
          color: #102033;
          font-family: ${isArabic ? '"TaskitArabic", ' : ''}Arial, "Helvetica Neue", sans-serif;
          background: #f7f8fa;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .paper { min-height: 100%; background: white; border: 1px solid #e2e7ee; padding: 40px; }
        .top { display: flex; justify-content: space-between; gap: 28px; align-items: flex-start; border-bottom: 1px solid #e2e7ee; padding-bottom: 26px; }
        .brand { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700; }
        h1 { margin: 8px 0 0; font-size: 40px; line-height: 1.1; }
        .number { margin-top: 8px; color: #64748b; font-size: 14px; font-weight: 700; }
        .badge { display: inline-flex; padding: 7px 12px; background: #edf7fb; color: #0369a1; font-size: 12px; font-weight: 800; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; }
        .box { border: 1px solid #e2e7ee; padding: 16px; background: #fbfcfd; break-inside: avoid; }
        .label { color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; }
        .name { font-size: 17px; font-weight: 800; overflow-wrap: anywhere; }
        .muted { color: #64748b; font-size: 13px; line-height: 1.55; margin-top: 4px; white-space: pre-line; overflow-wrap: anywhere; }
        .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 30px; page-break-inside: auto; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th { text-align: start; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #dbe3ed; padding: 11px 9px; }
        td { border-bottom: 1px solid #edf1f5; padding: 13px 9px; font-size: 13px; vertical-align: top; overflow-wrap: anywhere; }
        .numeric { text-align: end; white-space: nowrap; }
        .empty { color: #64748b; text-align: center; }
        .totals { width: 320px; margin-inline-start: auto; margin-top: 26px; }
        .total-row { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; font-size: 14px; color: #2e4060; }
        .grand { margin-top: 8px; border-top: 2px solid #102033; padding-top: 15px; color: #102033; font-size: 21px; font-weight: 900; }
        .footer { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-top: 34px; }
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
          <div class="badge">${escapeHtml(getInvoiceStatusLabel(invoice.status, locale))}</div>
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
          <div class="box"><div class="label">${copy.issueDate}</div><div class="name">${escapeHtml(formatDate(invoice.issueDate, locale))}</div></div>
          <div class="box"><div class="label">${copy.dueDate}</div><div class="name">${escapeHtml(formatDate(invoice.dueDate, locale))}</div></div>
          <div class="box"><div class="label">${copy.status}</div><div class="name">${escapeHtml(getInvoiceStatusLabel(invoice.status, locale))}</div></div>
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
          <div class="total-row"><span>${copy.subtotal}</span><strong>${escapeHtml(formatInvoiceMoney(invoice.subtotal, invoice.currency, locale))}</strong></div>
          <div class="total-row"><span>${copy.tax} (${toFiniteNumber(invoice.taxRate).toFixed(2)}%)</span><strong>${escapeHtml(formatInvoiceMoney(invoice.taxTotal, invoice.currency, locale))}</strong></div>
          <div class="total-row grand"><span>${copy.total}</span><span>${escapeHtml(formatInvoiceMoney(invoice.total, invoice.currency, locale))}</span></div>
        </section>

        <section class="footer">
          <div class="box">
            <div class="label">${copy.notes}</div>
            <div class="muted">${escapeHtml(invoice.notes || copy.thankYou)}</div>
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
  const puppeteer = await import('puppeteer-core')

  if (isServerless) {
    const { default: chromium } = await import('@sparticuz/chromium')
    chromium.setGraphicsMode = false
    chromiumExecutablePathPromise ??= chromium.executablePath()
    const headless = 'shell' as const

    return puppeteer.default.launch({
      args: puppeteer.default.defaultArgs({
        args: [...chromium.args, '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
        headless,
      }),
      defaultViewport: {
        width: 1240,
        height: 1754,
        deviceScaleFactor: 1,
      },
      executablePath: await chromiumExecutablePathPromise,
      headless,
      protocolTimeout: 25000,
    })
  }

  const executablePath = await resolveLocalChromeExecutablePath()
  return puppeteer.default.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    protocolTimeout: 25000,
  })
}

async function resolveLocalChromeExecutablePath() {
  const { existsSync } = await import('node:fs')
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean) as string[]

  const executablePath = candidates.find((candidate) => existsSync(candidate))
  if (!executablePath) {
    throw new Error('No local Chrome executable found. Set CHROME_EXECUTABLE_PATH for local PDF generation.')
  }

  return executablePath
}

async function closeBrowserSafely(browser: PdfBrowser) {
  try {
    for (const page of await browser.pages()) {
      await page.close().catch(() => undefined)
    }
    await Promise.race([
      browser.close(),
      new Promise((resolve) => {
        setTimeout(resolve, 2500)
      }),
    ])
  } catch {
    // Cleanup must not turn a successful PDF into a failed response.
  }
}

function pdfKitSafeText(value: unknown, allowUnicode: boolean) {
  const text = String(value ?? '')
  if (allowUnicode) return text
  return text.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?')
}

function diagnosticMessage(reason: unknown) {
  if (!reason) return ''
  const message = reason instanceof Error ? reason.message : String(reason)
  return message.replace(/[^\x20-\x7E]/g, '?').slice(0, 320)
}

async function generatePdfKitInvoicePdf(rawInvoice: PdfInvoice, reason: unknown, requestedLocale: string) {
  const PDFDocument = (await import('pdfkit')).default
  const invoice = normalizePdfInvoice({ ...rawInvoice, locale: requestedLocale })
  const locale = invoiceLocale(invoice.locale) === 'ar' ? 'en' : invoiceLocale(invoice.locale)
  const copy = invoiceCopy(locale)
  const doc = new PDFDocument({ size: 'A4', margin: 42, autoFirstPage: true, bufferPages: false })
  const chunks: Buffer[] = []
  const regularFont = 'Helvetica'
  const boldFont = 'Helvetica-Bold'
  const text = (value: unknown) => pdfKitSafeText(value, false)

  doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  doc.font(boldFont).fontSize(24).fillColor('#102033').text(text(copy.invoice))
  doc.font(regularFont).fontSize(10).fillColor('#64748b').text(text(invoice.invoiceNumber))
  doc.moveDown(1.5)

  doc.font(boldFont).fontSize(12).fillColor('#102033').text(text(copy.from))
  doc.font(regularFont).fontSize(10).fillColor('#2e4060').text(text(invoice.company.name))
  if (invoice.company.country) doc.text(text(invoice.company.country))
  doc.moveDown()

  doc.font(boldFont).fontSize(12).fillColor('#102033').text(text(copy.billTo))
  doc.font(regularFont).fontSize(10).fillColor('#2e4060').text(text(invoice.clientName))
  if (invoice.clientEmail) doc.text(text(invoice.clientEmail))
  if (invoice.clientAddress) doc.text(text(invoice.clientAddress))
  doc.moveDown()

  doc.font(boldFont).fontSize(11).text(text(`${copy.issueDate}: `), { continued: true })
  doc.font(regularFont).text(text(formatDate(invoice.issueDate, locale)))
  doc.font(boldFont).text(text(`${copy.dueDate}: `), { continued: true })
  doc.font(regularFont).text(text(formatDate(invoice.dueDate, locale)))
  doc.font(boldFont).text(text(`${copy.status}: `), { continued: true })
  doc.font(regularFont).text(text(getInvoiceStatusLabel(invoice.status, locale)))
  doc.moveDown()

  const headerY = doc.y
  doc.font(boldFont).fontSize(9).fillColor('#102033')
  doc.text(text(copy.description), 42, headerY, { width: 245 })
  doc.text(text(copy.quantity), 292, headerY, { width: 58, align: 'right' })
  doc.text(text(copy.unitPrice), 360, headerY, { width: 82, align: 'right' })
  doc.text(text(copy.amount), 455, headerY, { width: 90, align: 'right' })
  doc.moveTo(42, headerY + 18).lineTo(553, headerY + 18).strokeColor('#dbe3ed').stroke()
  doc.y = headerY + 28

  const rows = invoice.items.length ? invoice.items : [{ description: copy.noItems, quantity: 0, unitPrice: 0, lineTotal: 0 }]
  for (const item of rows) {
    const y = doc.y
    doc.font(regularFont).fontSize(9).fillColor('#102033')
    doc.text(text(item.description), 42, y, { width: 245 })
    doc.text(text(toFiniteNumber(item.quantity).toFixed(2)), 292, y, { width: 58, align: 'right' })
    doc.text(text(formatInvoiceMoney(item.unitPrice, invoice.currency, locale)), 360, y, { width: 82, align: 'right' })
    doc.text(text(formatInvoiceMoney(item.lineTotal, invoice.currency, locale)), 455, y, { width: 90, align: 'right' })
    doc.y = y + 24
  }

  doc.moveDown()
  doc.font(boldFont).fontSize(11)
  doc.text(text(`${copy.subtotal}: ${formatInvoiceMoney(invoice.subtotal, invoice.currency, locale)}`), { align: 'right' })
  doc.text(text(`${copy.tax}: ${formatInvoiceMoney(invoice.taxTotal, invoice.currency, locale)}`), { align: 'right' })
  doc.fontSize(15).text(text(`${copy.total}: ${formatInvoiceMoney(invoice.total, invoice.currency, locale)}`), { align: 'right' })
  doc.moveDown()

  doc.font(regularFont).fontSize(9).fillColor('#64748b').text(text(copy.fallbackNote))
  const diagnostic = diagnosticMessage(reason)
  if (diagnostic) {
    doc.fontSize(7).fillColor('#94a3b8').text(`Diagnostic: ${diagnostic}`)
  }

  doc.end()
  return done
}

export async function generateFallbackInvoicePdf(invoice: PdfInvoice, reason?: unknown) {
  const locale = invoiceLocale(invoice.locale)

  try {
    return await generatePdfKitInvoicePdf(invoice, reason, locale)
  } catch (error) {
    console.error('Invoice fallback PDFKit generation failed; retrying with ASCII-safe PDF.', {
      invoiceNumber: safeInvoiceNumber(invoice.invoiceNumber),
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    })
    return generatePdfKitInvoicePdf(invoice, reason, 'en')
  }
}

export async function generateInvoicePdf(rawInvoice: PdfInvoice) {
  const invoice = normalizePdfInvoice(rawInvoice)
  const warnings = validateInvoiceForPdf(invoice)

  if (warnings.length > 0) {
    console.warn('Invoice PDF generated with normalized fallback values.', {
      invoiceNumber: safeInvoiceNumber(invoice.invoiceNumber),
      warnings,
    })
  }

  let browser: PdfBrowser | null = null

  try {
    browser = await launchPdfBrowser()
    const page = await browser.newPage()
    page.setDefaultTimeout(15000)
    page.setDefaultNavigationTimeout(15000)
    await page.setContent(await renderInvoiceHtml(invoice), { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.evaluate(() => document.fonts.ready)
    await page.emulateMediaType('print')

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 20000,
    })
  } catch (error) {
    console.error('Chromium invoice PDF generation failed; using fallback PDF.', {
      invoiceNumber: safeInvoiceNumber(invoice.invoiceNumber),
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    })
    return generateFallbackInvoicePdf(invoice, error)
  } finally {
    if (browser) await closeBrowserSafely(browser)
  }
}
