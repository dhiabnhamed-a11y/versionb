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

export type InvoicePdfLogContext = {
  requestId?: string
  invoiceId?: string
  invoiceNumber?: string
  startedAt?: number
}

type RawPdfInvoice = Partial<PdfInvoice> & Record<string, unknown>
type Browser = Awaited<ReturnType<typeof launchPdfBrowser>>
type LogLevel = 'info' | 'warn' | 'error'

const PDF_SIGNATURE = '%PDF-'
const PDF_TIMEOUT_MS = 45_000
const CHROME_TIMEOUT_MS = 25_000
const VIEWPORT = {
  width: 1240,
  height: 1754,
  deviceScaleFactor: 1,
} as const

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

function logPdfEvent(level: LogLevel, event: string, context: InvoicePdfLogContext, meta: Record<string, unknown> = {}) {
  const payload = {
    scope: 'invoice-pdf-renderer',
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

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV)
}

function assertPdfBuffer(pdf: Uint8Array) {
  const signature = Buffer.from(pdf.slice(0, 5)).toString('ascii')
  if (pdf.byteLength < 5 || signature !== PDF_SIGNATURE) {
    throw new Error(`Chromium returned an invalid PDF buffer. byteLength=${pdf.byteLength} signature=${signature}`)
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, phase: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`Invoice PDF ${phase} timed out after ${timeoutMs}ms.`)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout)
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

export async function renderInvoiceHtml(rawInvoice: PdfInvoice) {
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
              <td class="description">${escapeHtml(item.description)}</td>
              <td class="numeric">${toFiniteNumber(item.quantity).toLocaleString(isArabic ? 'ar-TN' : 'en-US', {
                maximumFractionDigits: 2,
              })}</td>
              <td class="numeric">${escapeHtml(formatInvoiceMoney(item.unitPrice, invoice.currency, locale))}</td>
              <td class="numeric strong">${escapeHtml(formatInvoiceMoney(item.lineTotal, invoice.currency, locale))}</td>
            </tr>
          `
        )
        .join('')
    : `<tr><td colspan="4" class="empty">${copy.noItems}</td></tr>`

  return `<!doctype html>
  <html lang="${isArabic ? 'ar' : 'en'}" dir="${dir}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(invoice.invoiceNumber)}</title>
      <style>
        ${arabicFontCss}
        * { box-sizing: border-box; }
        html, body { min-height: 100%; }
        body {
          margin: 0;
          color: #172033;
          font-family: ${isArabic ? '"TaskitArabic", ' : ''}Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .paper {
          min-height: 297mm;
          padding: 44px 48px;
          background:
            linear-gradient(90deg, #172033 0, #172033 7px, transparent 7px),
            #ffffff;
        }
        .top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 32px;
          padding-bottom: 30px;
          border-bottom: 1px solid #dbe3ed;
        }
        .brand {
          margin-bottom: 18px;
          color: #637083;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0;
          text-transform: uppercase;
        }
        h1 {
          margin: 0;
          color: #111827;
          font-size: 44px;
          line-height: 1.05;
          font-weight: 900;
        }
        .invoice-number {
          margin-top: 10px;
          color: #64748b;
          font-size: 14px;
          font-weight: 800;
        }
        .status {
          min-width: 132px;
          padding: 10px 14px;
          border: 1px solid #bfdbfe;
          color: #075985;
          background: #eff6ff;
          font-size: 12px;
          font-weight: 900;
          text-align: center;
          text-transform: uppercase;
        }
        .party-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 28px;
        }
        .panel {
          padding: 18px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          break-inside: avoid;
        }
        .label {
          margin-bottom: 9px;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .name {
          color: #172033;
          font-size: 17px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }
        .muted {
          margin-top: 5px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.55;
          white-space: pre-line;
          overflow-wrap: anywhere;
        }
        .meta {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 18px;
        }
        .meta .name {
          font-size: 14px;
        }
        table {
          width: 100%;
          margin-top: 32px;
          border-collapse: collapse;
          page-break-inside: auto;
        }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th {
          padding: 12px 10px;
          border-bottom: 1px solid #cbd5e1;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-align: start;
          text-transform: uppercase;
        }
        td {
          padding: 15px 10px;
          border-bottom: 1px solid #e2e8f0;
          color: #243044;
          font-size: 13px;
          vertical-align: top;
        }
        .description {
          width: 52%;
          overflow-wrap: anywhere;
        }
        .numeric {
          text-align: end;
          white-space: nowrap;
        }
        .strong {
          color: #111827;
          font-weight: 800;
        }
        .empty {
          padding: 28px 10px;
          color: #64748b;
          text-align: center;
        }
        .totals {
          width: 340px;
          margin-top: 28px;
          margin-inline-start: auto;
          break-inside: avoid;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 9px 0;
          color: #475569;
          font-size: 14px;
        }
        .total-row strong {
          color: #172033;
        }
        .grand {
          margin-top: 8px;
          padding: 17px 0 0;
          border-top: 2px solid #172033;
          color: #111827;
          font-size: 22px;
          font-weight: 900;
        }
        .footer {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 36px;
        }
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          body { background: #ffffff; }
          .paper { min-height: 297mm; }
        }
      </style>
    </head>
    <body>
      <main class="paper">
        <section class="top">
          <div>
            <div class="brand">TASKIT</div>
            <h1>${copy.invoice}</h1>
            <div class="invoice-number">${escapeHtml(invoice.invoiceNumber)}</div>
          </div>
          <div class="status">${escapeHtml(getInvoiceStatusLabel(invoice.status, locale))}</div>
        </section>

        <section class="party-grid">
          <div class="panel">
            <div class="label">${copy.from}</div>
            <div class="name">${escapeHtml(invoice.company.name)}</div>
            <div class="muted">${escapeHtml(invoice.company.country ?? '')}${invoice.company.registrationNumber ? `<br>${escapeHtml(invoice.company.registrationNumber)}` : ''}</div>
          </div>
          <div class="panel">
            <div class="label">${copy.billTo}</div>
            <div class="name">${escapeHtml(invoice.clientName)}</div>
            <div class="muted">${escapeHtml(invoice.clientEmail ?? '')}${invoice.clientAddress ? `<br>${escapeHtml(invoice.clientAddress)}` : ''}</div>
          </div>
        </section>

        <section class="meta">
          <div class="panel"><div class="label">${copy.issueDate}</div><div class="name">${escapeHtml(formatDate(invoice.issueDate, locale))}</div></div>
          <div class="panel"><div class="label">${copy.dueDate}</div><div class="name">${escapeHtml(formatDate(invoice.dueDate, locale))}</div></div>
          <div class="panel"><div class="label">${copy.status}</div><div class="name">${escapeHtml(getInvoiceStatusLabel(invoice.status, locale))}</div></div>
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
          <div class="panel">
            <div class="label">${copy.notes}</div>
            <div class="muted">${escapeHtml(invoice.notes || copy.thankYou)}</div>
          </div>
          <div class="panel">
            <div class="label">${copy.preparedBy}</div>
            <div class="name">${escapeHtml(invoice.createdBy.name)}</div>
            <div class="muted">${escapeHtml(invoice.createdBy.email)}</div>
          </div>
        </section>
      </main>
    </body>
  </html>`
}

async function resolveServerlessChromiumPath(context: InvoicePdfLogContext) {
  const { default: chromium } = await import('@sparticuz/chromium')
  chromium.setGraphicsMode = false
  chromiumExecutablePathPromise ??= chromium.executablePath()
  const executablePath = await chromiumExecutablePathPromise

  logPdfEvent('info', 'chromium-executable-resolved', context, {
    executablePath,
    runtime: 'serverless',
  })

  return { chromium, executablePath }
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
    throw new Error('No local Chrome executable found. Set CHROME_EXECUTABLE_PATH or PUPPETEER_EXECUTABLE_PATH for local PDF generation.')
  }

  return executablePath
}

async function launchPdfBrowser(context: InvoicePdfLogContext) {
  const puppeteer = await import('puppeteer-core')

  if (isServerlessRuntime()) {
    const { chromium, executablePath } = await resolveServerlessChromiumPath(context)
    const headless = 'shell' as const

    return puppeteer.default.launch({
      args: puppeteer.default.defaultArgs({
        args: [...chromium.args, '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
        headless,
      }),
      defaultViewport: VIEWPORT,
      executablePath,
      headless,
      protocolTimeout: CHROME_TIMEOUT_MS,
    })
  }

  const executablePath = await resolveLocalChromeExecutablePath()
  logPdfEvent('info', 'chromium-executable-resolved', context, {
    executablePath,
    runtime: 'local',
  })

  return puppeteer.default.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    defaultViewport: VIEWPORT,
    executablePath,
    headless: true,
    protocolTimeout: CHROME_TIMEOUT_MS,
  })
}

async function closeBrowserSafely(browser: Browser, context: InvoicePdfLogContext) {
  try {
    const pages = await browser.pages().catch(() => [])
    await Promise.all(pages.map((page) => page.close().catch(() => undefined)))
    await withTimeout(browser.close(), 2_500, 'browser close')
  } catch (error) {
    logPdfEvent('warn', 'browser-close-failed', context, { error: errorDetails(error) })
  }
}

async function generateChromiumInvoicePdf(invoice: PdfInvoice, context: InvoicePdfLogContext) {
  let browser: Browser | null = null

  try {
    logPdfEvent('info', 'browser-launch-started', context)
    browser = await withTimeout(launchPdfBrowser(context), CHROME_TIMEOUT_MS, 'browser launch')
    logPdfEvent('info', 'browser-launch-completed', context)

    const page = await browser.newPage()
    page.setDefaultTimeout(15_000)
    page.setDefaultNavigationTimeout(15_000)

    logPdfEvent('info', 'html-render-started', context)
    const html = await renderInvoiceHtml(invoice)
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20_000 })
    await page.evaluate(() => document.fonts.ready.then(() => true))
    await page.emulateMediaType('print')
    logPdfEvent('info', 'html-render-completed', context)

    logPdfEvent('info', 'pdf-export-started', context)
    const pdf = await withTimeout(
      page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        timeout: 25_000,
      }),
      PDF_TIMEOUT_MS,
      'page PDF export'
    )
    assertPdfBuffer(pdf)
    logPdfEvent('info', 'pdf-export-completed', context, { byteLength: pdf.byteLength })

    return pdf
  } catch (error) {
    logPdfEvent('error', 'chromium-render-failed', context, { error: errorDetails(error) })
    throw error
  } finally {
    if (browser) await closeBrowserSafely(browser, context)
  }
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

  return generateChromiumInvoicePdf(invoice, logContext)
}
