import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logClientActivity, serializeClient } from '@/lib/clients'
import { emitCompanyRealtime, emitUserRealtime } from '@/lib/realtime-server'
import { ensureImportedBriefForCampaign } from '@/lib/creative-workflow'
import {
  calculateInvoiceTotals,
  centsToDecimal,
  normalizeCurrency,
  serializeInvoice,
  type InvoiceItemInput,
} from '@/lib/invoices'
import type { AiCitation, AiSessionUser } from '@/lib/ai-operations'

type AiActionResult = {
  handled: boolean
  answer?: string
  intent?: string
  confidence?: 'high' | 'medium' | 'low'
  citations?: AiCitation[]
  quickActions?: string[]
  facts?: Record<string, unknown>
}

type WorkspaceLookups = {
  clients: Array<{ id: string; companyName: string; email: string | null; address: string | null }>
  projects: Array<{ id: string; title: string; clientId: string | null; clientName: string | null }>
  categories: Array<{ id: string; name: string }>
}

const CREATE_WORDS = [
  'create',
  'make',
  'add',
  'draft',
  'generate',
  'start',
  'creer',
  'créer',
  'ajouter',
  'generer',
  'générer',
  'demarrer',
  'démarrer',
  'انشاء',
  'إنشاء',
  'انشئ',
  'أنشئ',
  'اضافة',
  'إضافة',
  'اصنع',
  'ابدأ',
]
const CAMPAIGN_WORDS = ['campaign', 'project', 'campagne', 'projet', 'حملة', 'حملات', 'مشروع', 'مشاريع']
const BRIEF_WORDS = ['brief', 'briefs', 'بريف', 'ملخص', 'ملخصات']
const INVOICE_WORDS = ['invoice', 'bill', 'facture', 'factures', 'فاتورة', 'فواتير']
const CLIENT_WORDS = ['client', 'customer', 'account', 'compte', 'عميل', 'عملاء', 'زبون']
const ALERT_WORDS = ['alert', 'notify', 'remind', 'send message', 'alerte', 'notifier', 'rappeler', 'تنبيه', 'نبه', 'ذكر']
const PAYMENT_WORDS = ['payment', 'invoice', 'due', 'deadline', 'paiement', 'facture', 'echeance', 'échéance', 'دفع', 'سداد', 'فاتورة', 'موعد']

function normalizeRole(role?: string | null) {
  return role?.trim().toUpperCase() || 'EMPLOYEE'
}

function canManageOperations(user: AiSessionUser) {
  const role = normalizeRole(user.role)
  return role === 'OWNER' || role === 'MANAGER'
}

function canManageInvoices(user: AiSessionUser) {
  return canManageOperations(user)
}

function includesAny(value: string, words: string[]) {
  return words.some((word) => value.includes(word))
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function sentenceCase(value: string) {
  const text = cleanText(value)
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function stripActionWords(value: string) {
  return cleanText(
    value
      .replace(/\b(please|pls|can you|could you|i want you to|i need you to|for me)\b/gi, ' ')
      .replace(/\b(create|make|add|draft|generate|start|open|new)\b/gi, ' ')
      .replace(/\b(a|an|the)\b/gi, ' ')
  )
}

function extractQuotedText(message: string) {
  const quoted = message.match(/["“']([^"”']{2,120})["”']/)
  return quoted?.[1]?.trim() ?? null
}

function extractAfterKeyword(message: string, keywords: string[]) {
  const pattern = new RegExp(`\\b(?:${keywords.join('|')})\\b\\s*(?:called|named|for|about|:)?\\s*([^,.\\n]{2,120})`, 'i')
  const match = message.match(pattern)
  return match?.[1]?.trim() ?? null
}

function removeTrailingOperationalPhrases(value: string) {
  return cleanText(
    value
      .replace(/\b(for|with|under|in category|category|client|customer|due|amount|total|worth|contact|email|phone|country|address|notes?)\b.*$/i, '')
      .replace(/\b(campaign|project|brief|invoice)\b/gi, '')
  )
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractLabeledValue(message: string, labels: string[]) {
  for (const label of labels) {
    const match = message.match(new RegExp(`(?:^|[\\n.;])\\s*${escapeRegExp(label)}\\s*:\\s*([^\\n.;]+)`, 'i'))
    if (match?.[1]?.trim()) return match[1].trim()
  }

  return null
}

function cleanClientNameFragment(value: string) {
  return cleanText(
    stripActionWords(value)
      .replace(/\b(client|customer|account|called|named|company|new)\b/gi, ' ')
      .replace(/\b(contact|email|phone|country|address|notes?|status)\b.*$/i, '')
  )
}

function findBestByName<T extends { companyName?: string; title?: string; name?: string }>(items: T[], message: string) {
  const lower = message.toLowerCase()
  return (
    items
      .map((item) => {
        const label = item.companyName ?? item.title ?? item.name ?? ''
        const normalized = label.toLowerCase()
        if (!normalized) return { item, score: 0 }
        if (lower.includes(normalized)) return { item, score: normalized.length + 20 }
        const tokens = normalized.split(/\s+/).filter((token) => token.length > 2)
        const score = tokens.reduce((sum, token) => sum + (lower.includes(token) ? token.length : 0), 0)
        return { item, score }
      })
      .sort((a, b) => b.score - a.score)[0]?.score
      ? items
          .map((item) => {
            const label = item.companyName ?? item.title ?? item.name ?? ''
            const normalized = label.toLowerCase()
            if (lower.includes(normalized)) return { item, score: normalized.length + 20 }
            const tokens = normalized.split(/\s+/).filter((token) => token.length > 2)
            return { item, score: tokens.reduce((sum, token) => sum + (lower.includes(token) ? token.length : 0), 0) }
          })
          .sort((a, b) => b.score - a.score)[0].item
      : null
  )
}

function extractTitle(message: string, kind: 'campaign' | 'project' | 'brief' | 'invoice') {
  const quoted = extractQuotedText(message)
  if (quoted) return sentenceCase(quoted)

  const after = extractAfterKeyword(message, [kind, kind === 'campaign' ? 'project' : 'campaign'])
  if (after) {
    const cleaned = removeTrailingOperationalPhrases(stripActionWords(after))
    if (cleaned) return sentenceCase(cleaned)
  }

  const stripped = removeTrailingOperationalPhrases(stripActionWords(message))
  return stripped ? sentenceCase(stripped) : ''
}

function extractClientName(message: string) {
  const labeled = extractLabeledValue(message, ['company name', 'client name', 'customer name'])
  if (labeled) return sentenceCase(labeled)

  const quoted = extractQuotedText(message)
  if (quoted) return sentenceCase(quoted)

  const after = extractAfterKeyword(message, ['client', 'customer', 'account'])
  if (after) {
    const cleaned = cleanClientNameFragment(after)
    if (cleaned) return sentenceCase(cleaned)
  }

  const cleaned = cleanClientNameFragment(message)
  return cleaned ? sentenceCase(cleaned) : ''
}

function extractDescription(message: string) {
  const match = message.match(/\b(?:description|desc|details|about|notes?)\s*:\s*([^]+)$/i)
  return match?.[1]?.trim() || null
}

function extractDueDate(message: string) {
  const iso = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]

  const inDays = message.match(/\b(?:in|after)\s+(\d{1,3})\s+days?\b/i)
  if (inDays) {
    const date = new Date()
    date.setDate(date.getDate() + Number(inDays[1]))
    return date.toISOString().slice(0, 10)
  }

  const nextWeek = /\bnext week\b/i.test(message)
  if (nextWeek) {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return date.toISOString().slice(0, 10)
  }

  return null
}

function extractMoney(message: string) {
  const match = message.match(/(?:\$|usd\s*)\s*(\d+(?:[,.]\d{1,2})?)/i) ?? message.match(/\b(\d+(?:[,.]\d{1,2})?)\s*(?:usd|dollars?)\b/i)
  if (!match) return null
  const amount = Number(match[1].replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function extractCurrency(message: string) {
  const match = message.match(/\b(USD|EUR|GBP|CAD|AUD|TND)\b/i)
  return normalizeCurrency(match?.[1] ?? 'USD')
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatActionDate(value?: Date | null) {
  if (!value) return 'No due date'
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatActionMoney(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function hasPaymentDeadlineAlertIntent(normalizedMessage: string) {
  return includesAny(normalizedMessage, ALERT_WORDS) && includesAny(normalizedMessage, PAYMENT_WORDS)
}

function getActionKind(message: string) {
  const lower = normalizeForMatch(message)
  if (hasPaymentDeadlineAlertIntent(lower)) return 'payment_alerts'
  if (!includesAny(lower, CREATE_WORDS)) return null
  if (includesAny(lower, INVOICE_WORDS)) return 'invoice'
  if (includesAny(lower, BRIEF_WORDS)) return 'brief'
  if (includesAny(lower, CLIENT_WORDS)) return 'client'
  if (includesAny(lower, CAMPAIGN_WORDS)) return 'campaign'
  return null
}

async function loadLookups(companyId: string): Promise<WorkspaceLookups> {
  const [clients, projects, categories] = await Promise.all([
    prisma.client.findMany({
      where: { companyId },
      select: { id: true, companyName: true, email: true, address: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.project.findMany({
      where: { companyId },
      select: { id: true, title: true, clientId: true, clientName: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.projectCategory.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
  ])

  return { clients, projects, categories }
}

function missingDetailsAnswer(kind: string, details: string[]) {
  return {
    handled: true,
    intent: `create_${kind}`,
    confidence: 'high' as const,
    answer: [
      'Direct Answer',
      `I can create that ${kind}, but I need ${details.join(' and ')} first.`,
      '',
      'Required Fields',
      ...details.map((detail) => `- ${detail}`),
      '',
      'Next Step',
      `Use the guided ${kind} creation flow in the assistant, or send the missing details in one message.`,
    ].join('\n'),
    citations: [],
    quickActions: ['Create campaign', 'Create brief', 'Create invoice', 'Create client'],
    facts: { missing: details },
  }
}

async function createCampaign(input: {
  message: string
  user: AiSessionUser
  lookups: WorkspaceLookups
}) {
  if (!input.user.companyId) return missingDetailsAnswer('campaign', ['an active workspace'])
  if (!canManageOperations(input.user)) {
    return {
      handled: true,
      intent: 'create_campaign',
      confidence: 'high' as const,
      answer: 'I cannot create campaigns for your current role. Ask an Owner or Manager to create the campaign, or send me a project question I can answer from your assigned work.',
      citations: [],
      quickActions: ['Analyze my overdue tasks', 'Summarize assigned projects'],
      facts: { forbidden: true },
    }
  }

  const title = extractTitle(input.message, 'campaign')
  if (!title || title.length < 3) return missingDetailsAnswer('campaign', ['a campaign name'])

  const client = findBestByName(input.lookups.clients, input.message)
  const requestedClientName = extractLabeledValue(input.message, ['client', 'client name', 'customer', 'customer name'])
  const category = findBestByName(input.lookups.categories, input.message) ?? (input.lookups.categories.length === 1 ? input.lookups.categories[0] : null)
  if (input.lookups.categories.length > 1 && !category) {
    return missingDetailsAnswer('campaign', [`one category (${input.lookups.categories.map((item) => item.name).slice(0, 5).join(', ')})`])
  }

  const project = await prisma.project.create({
    data: {
      title,
      description: extractDescription(input.message),
      companyId: input.user.companyId,
      categoryId: category?.id ?? null,
      clientId: client?.id ?? null,
      clientName: client?.companyName ?? requestedClientName ?? null,
      managerId: input.user.id,
      hasCamera: false,
      cameraType: 'device',
    },
    select: { id: true, title: true, clientName: true, category: { select: { name: true } } },
  })

  await ensureImportedBriefForCampaign({
    companyId: input.user.companyId,
    campaignId: project.id,
    clientId: client?.id ?? null,
    campaignTitle: project.title,
    campaignDescription: extractDescription(input.message),
    createdById: input.user.id,
  })
  emitCompanyRealtime(input.user.companyId, 'project_created', { project })

  return {
    handled: true,
    intent: 'create_campaign',
    confidence: 'high' as const,
    answer: [
      `Campaign created: ${project.title}`,
      client ? `Client: ${client.companyName}` : requestedClientName ? `Client: ${requestedClientName}` : '',
      project.category?.name ? `Category: ${project.category.name}` : '',
      '',
      'I also initialized the campaign brief so the team has a structured starting point.',
    ].filter(Boolean).join('\n'),
    citations: [{ type: 'project' as const, id: project.id, label: project.title, href: `/dashboard/admin/projects/${project.id}` }],
    quickActions: ['Create brief for this campaign', 'Generate invoice draft', 'Analyze delayed projects'],
    facts: { projectId: project.id, title: project.title },
  }
}

async function createBrief(input: {
  message: string
  user: AiSessionUser
  lookups: WorkspaceLookups
}) {
  if (!input.user.companyId) return missingDetailsAnswer('brief', ['an active workspace'])
  if (!canManageOperations(input.user)) {
    return {
      handled: true,
      intent: 'create_brief',
      confidence: 'high' as const,
      answer: 'I cannot create briefs for your current role. I can still summarize assigned work and identify blockers.',
      citations: [],
      quickActions: ['Summarize assigned projects', 'Show overdue tasks'],
      facts: { forbidden: true },
    }
  }

  const campaign = findBestByName(input.lookups.projects, input.message) ?? (input.lookups.projects.length === 1 ? input.lookups.projects[0] : null)
  if (!campaign) return missingDetailsAnswer('brief', ['the campaign name'])

  const title = extractTitle(input.message, 'brief') || `${campaign.title} brief`
  const existingClientId = campaign.clientId

  const brief = await prisma.brief.create({
    data: {
      companyId: input.user.companyId,
      campaignId: campaign.id,
      clientId: existingClientId,
      createdById: input.user.id,
      title,
      description: extractDescription(input.message) ?? input.message,
      objectives: Prisma.JsonNull,
      status: 'DRAFT',
    },
    include: {
      campaign: { select: { id: true, title: true } },
      client: { select: { id: true, companyName: true } },
    },
  })

  return {
    handled: true,
    intent: 'create_brief',
    confidence: 'high' as const,
    answer: [
      `Brief created: ${brief.title}`,
      `Campaign: ${brief.campaign.title}`,
      brief.client ? `Client: ${brief.client.companyName}` : '',
      '',
      'Status: Draft. Review the brief before converting it into deliverables or tasks.',
    ].filter(Boolean).join('\n'),
    citations: [{ type: 'project' as const, id: campaign.id, label: campaign.title, href: `/dashboard/admin/projects/${campaign.id}` }],
    quickActions: ['Create campaign', 'Create invoice', 'Summarize pending approvals'],
    facts: { briefId: brief.id, campaignId: campaign.id },
  }
}

async function nextInvoiceNumber(companyId: string) {
  const year = new Date().getFullYear()
  const count = await prisma.invoice.count({
    where: {
      companyId,
      invoiceNumber: { startsWith: `INV-${year}-` },
    },
  })

  return `INV-${year}-${String(count + 1).padStart(4, '0')}`
}

async function createInvoice(input: {
  message: string
  user: AiSessionUser
  lookups: WorkspaceLookups
}) {
  if (!input.user.companyId) return missingDetailsAnswer('invoice', ['an active workspace'])
  if (!canManageInvoices(input.user)) {
    return {
      handled: true,
      intent: 'create_invoice',
      confidence: 'high' as const,
      answer: 'I cannot create invoices for your current role. Invoice creation is limited to Owners and Managers.',
      citations: [],
      quickActions: ['Analyze my overdue tasks', 'Summarize assigned projects'],
      facts: { forbidden: true },
    }
  }

  const client = findBestByName(input.lookups.clients, input.message)
  const campaign = findBestByName(input.lookups.projects, input.message)
  const amount = extractMoney(input.message)
  if (!client && !campaign?.clientName) return missingDetailsAnswer('invoice', ['a client name'])
  if (!amount) return missingDetailsAnswer('invoice', ['an invoice amount such as "$1200"'])

  const clientName = client?.companyName ?? campaign?.clientName ?? ''
  const currency = extractCurrency(input.message)
  const itemDescription = extractTitle(input.message, 'invoice') || `Services for ${campaign?.title ?? clientName}`
  const rawItems: InvoiceItemInput[] = [{ description: itemDescription, quantity: 1, unitPrice: amount }]
  const totals = calculateInvoiceTotals(rawItems, 0)
  if (totals.items.length === 0) return missingDetailsAnswer('invoice', ['a line-item description'])

  const invoiceNumber = await nextInvoiceNumber(input.user.companyId)
  const dueDate = extractDueDate(input.message)
  const invoice = await prisma.invoice.create({
    data: {
      companyId: input.user.companyId,
      createdById: input.user.id,
      clientId: client?.id ?? campaign?.clientId ?? null,
      campaignId: campaign?.id ?? null,
      invoiceNumber,
      clientName,
      clientEmail: client?.email ?? null,
      clientAddress: client?.address ?? null,
      status: 'draft',
      currency,
      issueDate: new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: extractDescription(input.message),
      taxRate: new Prisma.Decimal(totals.taxRate.toFixed(2)),
      subtotal: centsToDecimal(totals.subtotalCents),
      taxTotal: centsToDecimal(totals.taxTotalCents),
      total: centsToDecimal(totals.totalCents),
      items: {
        create: totals.items.map((item) => ({
          description: item.description,
          quantity: new Prisma.Decimal(item.quantity.toFixed(2)),
          unitPrice: centsToDecimal(item.unitPriceCents),
          lineTotal: centsToDecimal(item.lineTotalCents),
        })),
      },
    },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      client: { select: { id: true, companyName: true } },
      campaign: { select: { id: true, title: true } },
    },
  })
  const serialized = serializeInvoice(invoice)
  emitCompanyRealtime(input.user.companyId, 'invoice_created', { invoice: serialized })

  return {
    handled: true,
    intent: 'create_invoice',
    confidence: 'high' as const,
    answer: [
      `Invoice draft created: ${invoice.invoiceNumber}`,
      `Client: ${invoice.clientName}`,
      `Total: ${new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(invoice.total))}`,
      dueDate ? `Due date: ${dueDate}` : '',
      '',
      'Status: Draft. Review taxes, notes, and line items before sending it to the client.',
    ].filter(Boolean).join('\n'),
    citations: [{ type: 'invoice' as const, id: invoice.id, label: `${invoice.invoiceNumber} - ${invoice.clientName}`, href: '/dashboard/admin/invoices' }],
    quickActions: ['Find overdue invoices', 'Create campaign', 'Generate weekly report'],
    facts: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, total: Number(invoice.total) },
  }
}

async function createClient(input: {
  message: string
  user: AiSessionUser
}) {
  if (!input.user.companyId) return missingDetailsAnswer('client', ['an active workspace'])
  if (!canManageOperations(input.user)) {
    return {
      handled: true,
      intent: 'create_client',
      confidence: 'high' as const,
      answer: 'I cannot create clients for your current role. Client creation is limited to Owners and Managers.',
      citations: [],
      quickActions: ['Summarize assigned projects', 'Show overdue tasks'],
      facts: { forbidden: true },
    }
  }

  const companyName = extractClientName(input.message)
  if (!companyName || companyName.length < 2) return missingDetailsAnswer('client', ['a client or company name'])

  const email = extractLabeledValue(input.message, ['email', 'client email'])
  const contactPerson = extractLabeledValue(input.message, ['contact person', 'contact'])
  const phone = extractLabeledValue(input.message, ['phone', 'phone number'])
  const country = extractLabeledValue(input.message, ['country'])
  const address = extractLabeledValue(input.message, ['address'])
  const notes = extractLabeledValue(input.message, ['notes', 'note'])

  const client = await prisma.client.create({
    data: {
      companyId: input.user.companyId,
      companyName,
      contactPerson: contactPerson || null,
      email: email?.toLowerCase() || null,
      phone: phone || null,
      country: country || null,
      address: address || null,
      notes: notes || null,
      status: 'active',
      activities: {
        create: {
          companyId: input.user.companyId,
          actorId: input.user.id,
          type: 'client.created',
          title: 'Client created by AI',
          body: 'The AI assistant collected the required fields and created this client profile.',
        },
      },
    },
    include: {
      _count: { select: { projects: true, invoices: true } },
    },
  })

  const serialized = { ...serializeClient(client), unpaidTotal: 0 }
  emitCompanyRealtime(input.user.companyId, 'client_created', { client: serialized })
  await logClientActivity({
    companyId: input.user.companyId,
    clientId: client.id,
    actorId: input.user.id,
    type: 'client.profile_ready',
    title: 'Client profile is ready',
    body: 'Campaigns, briefs, invoices, notes, and payment follow-up can now be tracked from this profile.',
  })

  return {
    handled: true,
    intent: 'create_client',
    confidence: 'high' as const,
    answer: [
      'Direct Answer',
      `Client created: ${client.companyName}`,
      '',
      'Client Profile',
      contactPerson ? `- Contact: ${contactPerson}` : '',
      email ? `- Email: ${email.toLowerCase()}` : '',
      phone ? `- Phone: ${phone}` : '',
      country ? `- Country: ${country}` : '',
      '',
      'Suggested Next Actions',
      '- Create the first campaign for this client.',
      '- Draft a brief once the campaign objective is clear.',
      '- Create an invoice when billing details are ready.',
    ].filter(Boolean).join('\n'),
    citations: [{ type: 'client' as const, id: client.id, label: client.companyName, href: `/dashboard/admin/clients/${client.id}` }],
    quickActions: ['Create campaign', 'Create brief', 'Create invoice', 'Send payment deadline alerts'],
    facts: { clientId: client.id, companyName: client.companyName },
  }
}

async function sendPaymentDeadlineAlerts(input: {
  user: AiSessionUser
}) {
  if (!input.user.companyId) return missingDetailsAnswer('payment alert', ['an active workspace'])
  if (!canManageInvoices(input.user)) {
    return {
      handled: true,
      intent: 'payment_deadline_alerts',
      confidence: 'high' as const,
      answer: 'I cannot send payment-deadline alerts for your current role. Invoice follow-up is limited to Owners and Managers.',
      citations: [],
      quickActions: ['Analyze my overdue tasks', 'Summarize assigned projects'],
      facts: { forbidden: true },
    }
  }

  const now = new Date()
  const dueSoonCutoff = addDays(now, 7)
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: input.user.companyId,
      status: { in: ['sent', 'overdue'] },
      paidAt: null,
      OR: [{ dueDate: { lte: dueSoonCutoff } }, { status: 'overdue' }],
    },
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      dueDate: true,
      status: true,
      total: true,
      currency: true,
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 20,
  })

  if (invoices.length === 0) {
    return {
      handled: true,
      intent: 'payment_deadline_alerts',
      confidence: 'high' as const,
      answer: [
        'Direct Answer',
        'No sent or overdue client-payment invoices are due within the next 7 days.',
        '',
        'Suggested Next Actions',
        '- Review draft invoices before sending them.',
        '- Ask me to find overdue invoices when you want a finance risk scan.',
      ].join('\n'),
      citations: [],
      quickActions: ['Find overdue invoices', 'Create invoice', 'Analyze delayed projects'],
      facts: { alertsSent: 0, invoiceCount: 0 },
    }
  }

  const recipients = await prisma.user.findMany({
    where: {
      companyId: input.user.companyId,
      role: { in: ['OWNER', 'MANAGER'] },
      accountStatus: 'ACTIVE',
    },
    select: { id: true },
    take: 100,
  })
  const alertRecipients = recipients.length ? recipients : [{ id: input.user.id }]
  const today = startOfDay(now)
  let createdAlerts = 0
  let suppressedDuplicates = 0

  for (const invoice of invoices) {
    const isOverdue = invoice.status === 'overdue' || Boolean(invoice.dueDate && invoice.dueDate < now)
    for (const recipient of alertRecipients) {
      const existing = await prisma.alert.findFirst({
        where: {
          recipientId: recipient.id,
          type: 'CLIENT_PAYMENT_DEADLINE',
          entityType: 'invoice',
          entityId: invoice.id,
          createdAt: { gte: today },
        },
        select: { id: true },
      })
      if (existing) {
        suppressedDuplicates += 1
        continue
      }

      const alert = await prisma.alert.create({
        data: {
          companyId: input.user.companyId,
          type: 'CLIENT_PAYMENT_DEADLINE',
          title: isOverdue ? `Payment overdue: ${invoice.clientName}` : `Payment due soon: ${invoice.clientName}`,
          message: `${invoice.invoiceNumber} is ${isOverdue ? 'overdue' : 'due soon'} for ${formatActionMoney(Number(invoice.total), invoice.currency)}. Due date: ${formatActionDate(invoice.dueDate)}.`,
          senderId: input.user.id,
          recipientId: recipient.id,
          priority: isOverdue ? 'HIGH' : 'NORMAL',
          entityType: 'invoice',
          entityId: invoice.id,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            clientName: invoice.clientName,
            dueDate: invoice.dueDate?.toISOString() ?? null,
            status: invoice.status,
            total: Number(invoice.total),
            currency: invoice.currency,
          },
        },
      })

      createdAlerts += 1
      emitUserRealtime(recipient.id, 'alert', {
        id: alert.id,
        type: alert.type,
        title: alert.title,
        message: alert.message,
        read: alert.read,
        createdAt: alert.createdAt,
      })
    }
  }

  const visibleInvoices = invoices.slice(0, 6)

  return {
    handled: true,
    intent: 'payment_deadline_alerts',
    confidence: 'high' as const,
    answer: [
      'Direct Answer',
      `Payment-deadline alerts sent: ${createdAlerts}.`,
      '',
      'Invoices Covered',
      ...visibleInvoices.map((invoice) => {
        const isOverdue = invoice.status === 'overdue' || Boolean(invoice.dueDate && invoice.dueDate < now)
        return `- ${invoice.invoiceNumber} (${invoice.clientName}) - ${formatActionMoney(Number(invoice.total), invoice.currency)}, ${isOverdue ? 'overdue' : 'due soon'}, due ${formatActionDate(invoice.dueDate)}`
      }),
      '',
      'Governance',
      `- Alerts were sent to active Owners and Managers in this workspace (${alertRecipients.length} recipient${alertRecipients.length === 1 ? '' : 's'}).`,
      suppressedDuplicates ? `- ${suppressedDuplicates} duplicate alert${suppressedDuplicates === 1 ? '' : 's'} already existed today and were not resent.` : '',
    ].filter(Boolean).join('\n'),
    citations: visibleInvoices.map((invoice) => ({
      type: 'invoice' as const,
      id: invoice.id,
      label: `${invoice.invoiceNumber} - ${invoice.clientName}`,
      href: '/dashboard/admin/invoices',
    })),
    quickActions: ['Find overdue invoices', 'Create invoice', 'Analyze delayed projects'],
    facts: {
      alertsSent: createdAlerts,
      duplicatesSuppressed: suppressedDuplicates,
      invoiceCount: invoices.length,
      recipientCount: alertRecipients.length,
    },
  }
}

export async function executeAiWorkspaceAction(input: {
  message: string
  user: AiSessionUser
}): Promise<AiActionResult> {
  const kind = getActionKind(input.message)
  if (!kind) return { handled: false }
  if (!input.user.companyId) return missingDetailsAnswer(kind, ['an active workspace'])

  if (kind === 'client') return createClient({ message: input.message, user: input.user })
  if (kind === 'payment_alerts') return sendPaymentDeadlineAlerts({ user: input.user })

  const lookups = await loadLookups(input.user.companyId)
  if (kind === 'campaign') return createCampaign({ message: input.message, user: input.user, lookups })
  if (kind === 'brief') return createBrief({ message: input.message, user: input.user, lookups })
  if (kind === 'invoice') return createInvoice({ message: input.message, user: input.user, lookups })

  return { handled: false }
}
