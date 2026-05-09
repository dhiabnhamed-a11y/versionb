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
  const amount = typeof value === 'number' ? value : Number(String(value ?? 0))
  return Number.isFinite(amount) ? amount : 0
}

function safeInvoiceNumber(value: unknown) {
  const invoiceNumber = String(value ?? '').trim()
  return invoiceNumber || 'invoice'
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
        thankYou: 'Thank you for your business.',
        fallbackNote: 'This simplified PDF was generated because the advanced PDF service is temporarily unavailable.',
      }
}

function formatDate(value: Date | string | null | undefined, locale: string) {
  if (!value) return invoiceCopy(locale).notSet
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
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

async function renderInvoiceHtml(invoice: PdfInvoice) {
  const locale = invoiceLocale(invoice.locale)
  const isArabic = locale === 'ar'
  const dir = isArabic ? 'rtl' : 'ltr'
  const copy = invoiceCopy(locale)
  const arabicFontCss = isArabic ? await getArabicFontCss() : ''
  const rows = Array.isArray(invoice.items)
    ? invoice.items
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.description || '-')}</td>
              <td class="numeric">${toFiniteNumber(item.quantity).toFixed(2)}</td>
              <td class="numeric">${formatInvoiceMoney(toFiniteNumber(item.unitPrice), invoice.currency, locale)}</td>
              <td class="numeric">${formatInvoiceMoney(toFiniteNumber(item.lineTotal), invoice.currency, locale)}</td>
            </tr>
          `
        )
        .join('')
    : ''

  return `<!doctype html>
  <html lang="${isArabic ? 'ar' : 'en'}" dir="${dir}">
    <head>
      <meta charset="utf-8" />
      <style>
        ${arabicFontCss}
        * { box-sizing: border-box; }
        body { margin: 0; padding: 42px; color: #102033; font-family: ${isArabic ? '"TaskitArabic", ' : ''}Arial, "Helvetica Neue", sans-serif; background: #f7f8fa; }
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
            <div class="number">${escapeHtml(safeInvoiceNumber(invoice.invoiceNumber))}</div>
          </div>
          <div class="badge">${getInvoiceStatusLabel(invoice.status, locale)}</div>
        </section>

        <section class="grid">
          <div class="box">
            <div class="label">${copy.from}</div>
            <div class="name">${escapeHtml(invoice.company?.name ?? 'TASKIT')}</div>
            <div class="muted">${escapeHtml(invoice.company?.country ?? '')}${invoice.company?.registrationNumber ? `<br/>${escapeHtml(invoice.company.registrationNumber)}` : ''}</div>
          </div>
          <div class="box">
            <div class="label">${copy.billTo}</div>
            <div class="name">${escapeHtml(invoice.clientName || 'Client')}</div>
            <div class="muted">${escapeHtml(invoice.clientEmail ?? '')}${invoice.clientAddress ? `<br/>${escapeHtml(invoice.clientAddress)}` : ''}</div>
          </div>
        </section>

        <section class="meta">
          <div class="box"><div class="label">${copy.issueDate}</div><div class="name">${formatDate(invoice.issueDate, locale)}</div></div>
          <div class="box"><div class="label">${copy.dueDate}</div><div class="name">${formatDate(invoice.dueDate, locale)}</div></div>
          <div class="box"><div class="label">${copy.status}</div><div class="name">${getInvoiceStatusLabel(invoice.status, locale)}</div></div>
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
          <div class="total-row"><span>${copy.subtotal}</span><strong>${formatInvoiceMoney(toFiniteNumber(invoice.subtotal), invoice.currency, locale)}</strong></div>
          <div class="total-row"><span>${copy.tax} (${toFiniteNumber(invoice.taxRate).toFixed(2)}%)</span><strong>${formatInvoiceMoney(toFiniteNumber(invoice.taxTotal), invoice.currency, locale)}</strong></div>
          <div class="total-row grand"><span>${copy.total}</span><span>${formatInvoiceMoney(toFiniteNumber(invoice.total), invoice.currency, locale)}</span></div>
        </section>

        <section class="footer">
          <div class="box">
            <div class="label">${copy.notes}</div>
            <div class="muted">${escapeHtml(invoice.notes || copy.thankYou)}</div>
          </div>
          <div class="box">
            <div class="label">${copy.preparedBy}</div>
            <div class="name">${escapeHtml(invoice.createdBy?.name ?? '')}</div>
            <div class="muted">${escapeHtml(invoice.createdBy?.email ?? '')}</div>
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
    const executablePath = await chromiumExecutablePathPromise
    const headless = 'shell' as const

    return puppeteer.default.launch({
      args: puppeteer.default.defaultArgs({
        args: [...chromium.args, '--disable-dev-shm-usage', '--disable-gpu'],
        headless,
      }),
      defaultViewport: { width: 1240, height: 1754 },
      executablePath,
      headless,
    })
  }

  const executablePath = await resolveLocalChromeExecutablePath()
  return puppeteer.default.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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

async function closeBrowserSafely(browser: Awaited<ReturnType<typeof launchPdfBrowser>>) {
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

function validateInvoiceForPdf(invoice: PdfInvoice) {
  const missingFields: string[] = []
  if (!String(invoice.invoiceNumber ?? '').trim()) missingFields.push('invoiceNumber')
  if (!String(invoice.clientName ?? '').trim()) missingFields.push('clientName')
  if (!invoice.company?.name) missingFields.push('company.name')
  if (!invoice.createdBy?.email) missingFields.push('createdBy.email')
  if (!Array.isArray(invoice.items)) missingFields.push('items')
  return missingFields
}

export async function generateFallbackInvoicePdf(invoice: PdfInvoice, reason?: unknown) {
  const PDFDocument = (await import('pdfkit')).default
  const locale = invoiceLocale(invoice.locale)
  const copy = invoiceCopy(locale)
  const doc = new PDFDocument({ size: 'A4', margin: 42, autoFirstPage: true })
  const chunks: Buffer[] = []

  doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  doc.font('Helvetica-Bold').fontSize(24).fillColor('#102033').text(copy.invoice)
  doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(safeInvoiceNumber(invoice.invoiceNumber))
  doc.moveDown(1.5)

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#102033').text(copy.from)
  doc.font('Helvetica').fontSize(10).fillColor('#2e4060').text(String(invoice.company?.name ?? 'TASKIT'))
  if (invoice.company?.country) doc.text(String(invoice.company.country))
  doc.moveDown()

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#102033').text(copy.billTo)
  doc.font('Helvetica').fontSize(10).fillColor('#2e4060').text(String(invoice.clientName || 'Client'))
  if (invoice.clientEmail) doc.text(String(invoice.clientEmail))
  if (invoice.clientAddress) doc.text(String(invoice.clientAddress))
  doc.moveDown()

  doc.font('Helvetica-Bold').fontSize(11).text(`${copy.issueDate}: `, { continued: true })
  doc.font('Helvetica').text(formatDate(invoice.issueDate, locale))
  doc.font('Helvetica-Bold').text(`${copy.dueDate}: `, { continued: true })
  doc.font('Helvetica').text(formatDate(invoice.dueDate, locale))
  doc.font('Helvetica-Bold').text(`${copy.status}: `, { continued: true })
  doc.font('Helvetica').text(getInvoiceStatusLabel(invoice.status, locale))
  doc.moveDown()

  const headerY = doc.y
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#102033')
  doc.text(copy.description, 42, headerY, { width: 245 })
  doc.text(copy.quantity, 292, headerY, { width: 58, align: 'right' })
  doc.text(copy.unitPrice, 360, headerY, { width: 82, align: 'right' })
  doc.text(copy.amount, 455, headerY, { width: 90, align: 'right' })
  doc.moveTo(42, headerY + 18).lineTo(553, headerY + 18).strokeColor('#dbe3ed').stroke()
  doc.y = headerY + 28

  for (const item of Array.isArray(invoice.items) ? invoice.items : []) {
    const y = doc.y
    doc.font('Helvetica').fontSize(9).fillColor('#102033')
    doc.text(String(item.description || '-'), 42, y, { width: 245 })
    doc.text(toFiniteNumber(item.quantity).toFixed(2), 292, y, { width: 58, align: 'right' })
    doc.text(formatInvoiceMoney(toFiniteNumber(item.unitPrice), invoice.currency, locale), 360, y, { width: 82, align: 'right' })
    doc.text(formatInvoiceMoney(toFiniteNumber(item.lineTotal), invoice.currency, locale), 455, y, { width: 90, align: 'right' })
    doc.y = y + 24
  }

  doc.moveDown()
  doc.font('Helvetica-Bold').fontSize(11)
  doc.text(`${copy.subtotal}: ${formatInvoiceMoney(toFiniteNumber(invoice.subtotal), invoice.currency, locale)}`, { align: 'right' })
  doc.text(`${copy.tax}: ${formatInvoiceMoney(toFiniteNumber(invoice.taxTotal), invoice.currency, locale)}`, { align: 'right' })
  doc.fontSize(15).text(`${copy.total}: ${formatInvoiceMoney(toFiniteNumber(invoice.total), invoice.currency, locale)}`, { align: 'right' })
  doc.moveDown()

  doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(copy.fallbackNote)
  if (reason) {
    doc.fontSize(7).fillColor('#94a3b8').text(`Diagnostic: ${reason instanceof Error ? reason.message : String(reason)}`)
  }

  doc.end()
  return done
}

export async function generateInvoicePdf(invoice: PdfInvoice) {
  const missingFields = validateInvoiceForPdf(invoice)
  if (missingFields.length > 0) {
    return generateFallbackInvoicePdf(invoice, `Invalid invoice fields: ${missingFields.join(', ')}`)
  }

  let browser: Awaited<ReturnType<typeof launchPdfBrowser>> | null = null

  try {
    browser = await launchPdfBrowser()
    const page = await browser.newPage()
    page.setDefaultTimeout(15000)
    page.setDefaultNavigationTimeout(15000)
    await page.setContent(await renderInvoiceHtml(invoice), { waitUntil: 'load', timeout: 15000 })
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
