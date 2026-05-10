import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { emitCompanyRealtime } from '@/lib/realtime-server'
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

const CREATE_WORDS = ['create', 'make', 'add', 'draft', 'generate', 'start']

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
      .replace(/\b(for|with|under|in category|category|client|customer|due|amount|total|worth)\b.*$/i, '')
      .replace(/\b(campaign|project|brief|invoice)\b/gi, '')
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

function getActionKind(message: string) {
  const lower = message.toLowerCase()
  if (!includesAny(lower, CREATE_WORDS)) return null
  if (lower.includes('invoice') || lower.includes('bill')) return 'invoice'
  if (lower.includes('brief')) return 'brief'
  if (lower.includes('campaign') || lower.includes('project')) return 'campaign'
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
    answer: `I can create that ${kind}, but I need ${details.join(' and ')} first. Send it in one message and I will create it from the workspace records.`,
    citations: [],
    quickActions: ['Create campaign', 'Create brief', 'Create invoice'],
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
      clientName: client?.companyName ?? null,
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
      client ? `Client: ${client.companyName}` : '',
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

export async function executeAiWorkspaceAction(input: {
  message: string
  user: AiSessionUser
}): Promise<AiActionResult> {
  const kind = getActionKind(input.message)
  if (!kind) return { handled: false }
  if (!input.user.companyId) return missingDetailsAnswer(kind, ['an active workspace'])

  const lookups = await loadLookups(input.user.companyId)
  if (kind === 'campaign') return createCampaign({ message: input.message, user: input.user, lookups })
  if (kind === 'brief') return createBrief({ message: input.message, user: input.user, lookups })
  if (kind === 'invoice') return createInvoice({ message: input.message, user: input.user, lookups })

  return { handled: false }
}
