import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logClientActivity, serializeClient } from '@/lib/clients'
import { emitCompanyRealtime, emitUserRealtime } from '@/lib/realtime-server'
import { ensureImportedBriefForCampaign } from '@/lib/creative-workflow'
import { deleteClientGraph, deleteProjectGraph, deleteTasksById } from '@/lib/delete-graph'
import {
  calculateInvoiceTotals,
  centsToDecimal,
  normalizeCurrency,
  serializeInvoice,
  type InvoiceItemInput,
} from '@/lib/invoices'
import {
  resolveIntent,
  type AiAmbiguityPanelPayload,
  type IntentRecordCandidate,
  type ResolvedIntent,
} from '@/lib/ai-intent'
import type { AiCitation, AiSessionUser } from '@/lib/ai-operations'
import {
  createAiActionPreview,
  createPreviewAnswer,
  loadAiActionForConfirmation,
  markAiActionCompleted,
  markAiActionExecuting,
  markAiActionFailed,
  parseStoredActionInput,
  type AiActionPreviewCard,
  type AiActionPreviewPayload,
} from '@/modules/ai/runtime/governance'
import { getAiToolForActionKind } from '@/modules/ai/tools/registry'

type AiActionResult = {
  handled: boolean
  answer?: string
  intent?: string
  confidence?: 'high' | 'medium' | 'low'
  citations?: AiCitation[]
  quickActions?: string[]
  facts?: Record<string, unknown>
  ambiguity?: AiAmbiguityPanelPayload
  resolvedIntent?: ResolvedIntent
  actionPreview?: AiActionPreviewCard
  executionReceipt?: Record<string, unknown>
}

type WorkspaceLookups = {
  clients: Array<{ id: string; companyName: string; email: string | null; address: string | null }>
  projects: Array<{ id: string; title: string; clientId: string | null; clientName: string | null }>
  categories: Array<{ id: string; name: string }>
  managers: Array<{ id: string; name: string; role: string }>
  invoices: Array<{ id: string; invoiceNumber: string; clientName: string; status: string; total: Prisma.Decimal; currency: string; dueDate: Date | null; paidAt: Date | null; createdAt: Date }>
  briefs: Array<{ id: string; title: string; campaign: { title: string } }>
  deliverables: Array<{ id: string; title: string; campaign: { title: string } }>
  tasks: Array<{ id: string; title: string; project: { title: string } }>
  rooms: Array<{ id: string; name: string }>
}

type DeletableKind = 'invoice' | 'client' | 'campaign' | 'brief' | 'deliverable' | 'task' | 'category' | 'room'

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
const TASK_WORDS = ['task', 'tasks', 'todo', 'mission', 'tache', 'taches', 'مهمة', 'مهام']
const DELIVERABLE_WORDS = ['deliverable', 'deliverables', 'livrable', 'livrables', 'تسليم', 'تسليمات']
const CATEGORY_WORDS = ['category', 'categories', 'categorie', 'categories', 'فئة', 'تصنيف']
const ROOM_WORDS = ['room', 'rooms', 'workspace room', 'salle', 'espace', 'غرفة', 'مساحة']
const ALERT_WORDS = ['alert', 'notify', 'remind', 'send message', 'alerte', 'notifier', 'rappeler', 'تنبيه', 'نبه', 'ذكر']
const PAYMENT_WORDS = ['payment', 'invoice', 'due', 'deadline', 'paiement', 'facture', 'echeance', 'échéance', 'دفع', 'سداد', 'فاتورة', 'موعد']
const DELETE_WORDS = ['delete', 'remove', 'erase', 'supprimer', 'effacer', 'retirer', 'حذف', 'احذف', 'مسح', 'امسح']
const UPDATE_WORDS = ['mark', 'set', 'update', 'change', 'modifier', 'mettre', 'marquer', 'تحديث', 'حدث', 'غير']
const PAID_WORDS = ['paid', 'payed', 'payment received', 'paye', 'payee', 'reglee', 'مدفوعة', 'مدفوع', 'تم الدفع']

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

function findById<T extends { id: string }>(items: T[], id: string | null | undefined) {
  if (!id) return null
  return items.find((item) => item.id === id.trim()) ?? null
}

function findByLooseId<T extends { id: string }>(items: T[], id: string | null | undefined) {
  if (!id) return null
  const normalized = id.trim().toLowerCase()
  if (!normalized) return null
  return items.find((item) => {
    const candidate = item.id.toLowerCase()
    return candidate === normalized || candidate.endsWith(normalized)
  }) ?? null
}

type ResolvedTarget<T> =
  | { status: 'found'; item: T }
  | { status: 'missing'; examples: string[] }
  | { status: 'ambiguous'; options: string[] }

function normalizeRecordText(value: string) {
  return normalizeForMatch(value).replace(/[^a-z0-9\u0600-\u06FF]+/gi, ' ').trim()
}

function compactLabels(labels: Array<string | null | undefined>) {
  return labels.map((label) => cleanText(label ?? '')).filter(Boolean)
}

function scoreLabelAgainstMessage(message: string, label: string) {
  const normalizedLabel = normalizeRecordText(label)
  if (!normalizedLabel) return 0
  if (message.includes(normalizedLabel)) return normalizedLabel.length + 25

  const tokens = normalizedLabel.split(/\s+/).filter((token) => token.length > 2)
  return tokens.reduce((score, token) => score + (message.includes(token) ? token.length : 0), 0)
}

function resolveTargetByText<T extends { id: string }>(
  items: T[],
  message: string,
  getLabels: (item: T) => Array<string | null | undefined>
): ResolvedTarget<T> {
  if (items.length === 0) return { status: 'missing', examples: [] }

  const normalizedMessage = normalizeRecordText(message)
  const exactMatches = items
    .map((item) => ({
      item,
      labelLength: Math.max(0, ...compactLabels(getLabels(item)).map((label) => normalizeRecordText(label).length)),
      matched: compactLabels(getLabels(item)).some((label) => {
        const normalizedLabel = normalizeRecordText(label)
        return normalizedLabel.length > 1 && normalizedMessage.includes(normalizedLabel)
      }),
    }))
    .filter((candidate) => candidate.matched)
    .sort((a, b) => b.labelLength - a.labelLength)

  if (exactMatches.length === 1) return { status: 'found', item: exactMatches[0].item }
  if (exactMatches.length > 1 && exactMatches[0].labelLength > exactMatches[1].labelLength + 4) {
    return { status: 'found', item: exactMatches[0].item }
  }
  if (exactMatches.length > 1) {
    return { status: 'ambiguous', options: exactMatches.slice(0, 5).map((candidate) => compactLabels(getLabels(candidate.item))[0] ?? candidate.item.id) }
  }

  const scored = items
    .map((item) => ({
      item,
      score: Math.max(0, ...compactLabels(getLabels(item)).map((label) => scoreLabelAgainstMessage(normalizedMessage, label))),
    }))
    .filter((candidate) => candidate.score >= 4)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return { status: 'missing', examples: items.slice(0, 5).map((item) => compactLabels(getLabels(item))[0] ?? item.id) }
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return { status: 'ambiguous', options: scored.slice(0, 5).map((candidate) => compactLabels(getLabels(candidate.item))[0] ?? candidate.item.id) }
  }

  return { status: 'found', item: scored[0].item }
}

function resolveTarget<T extends { id: string }>(
  items: T[],
  message: string,
  idLabels: string[],
  getLabels: (item: T) => Array<string | null | undefined>
): ResolvedTarget<T> {
  const requestedId = extractLabeledValue(message, idLabels)
  if (requestedId) {
    const item = findByLooseId(items, requestedId)
    if (item) return { status: 'found', item }
    return { status: 'missing', examples: items.slice(0, 5).map((candidate) => compactLabels(getLabels(candidate))[0] ?? candidate.id) }
  }

  const bareIdentifier = message.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)?.[0]
    ?? message.match(/\b(c[a-z0-9]{8,}|[a-z0-9_-]{12,}|\d{2,})\b/i)?.[0]
  const bareMatch = findByLooseId(items, bareIdentifier)
  if (bareMatch) return { status: 'found', item: bareMatch }

  return resolveTargetByText(items, message, getLabels)
}

function extractInvoiceNumber(message: string) {
  const labeled = extractLabeledValue(message, ['invoice number', 'invoice no', 'number'])
  if (labeled) return labeled.trim()
  return message.match(/\bINV-\d{4}-\d{4}\b/i)?.[0] ?? null
}

function resolveInvoiceTarget(invoices: WorkspaceLookups['invoices'], message: string): ResolvedTarget<WorkspaceLookups['invoices'][number]> {
  const requestedId = extractLabeledValue(message, ['invoice id', 'invoiceId', 'id'])
  if (requestedId) {
    const invoice = findByLooseId(invoices, requestedId)
    if (invoice) return { status: 'found', item: invoice }
    return { status: 'missing', examples: invoices.slice(0, 5).map((item) => `${item.invoiceNumber} - ${item.clientName}`) }
  }

  const bareIdentifier = message.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)?.[0]
    ?? message.match(/\b(c[a-z0-9]{8,}|[a-z0-9_-]{12,})\b/i)?.[0]
  const bareMatch = findByLooseId(invoices, bareIdentifier)
  if (bareMatch) return { status: 'found', item: bareMatch }

  const invoiceNumber = extractInvoiceNumber(message)
  if (invoiceNumber) {
    const invoice = invoices.find((item) => item.invoiceNumber.toLowerCase() === invoiceNumber.toLowerCase())
    if (invoice) return { status: 'found', item: invoice }
    return { status: 'missing', examples: invoices.slice(0, 5).map((item) => `${item.invoiceNumber} - ${item.clientName}`) }
  }

  return resolveTargetByText(invoices, message, (invoice) => [invoice.invoiceNumber, invoice.clientName])
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

function hasMarkInvoicePaidIntent(normalizedMessage: string) {
  return includesAny(normalizedMessage, UPDATE_WORDS) && includesAny(normalizedMessage, PAID_WORDS) && includesAny(normalizedMessage, INVOICE_WORDS)
}

function deleteKindFromMessage(normalizedMessage: string): DeletableKind | null {
  if (includesAny(normalizedMessage, INVOICE_WORDS)) return 'invoice'
  if (includesAny(normalizedMessage, CLIENT_WORDS)) return 'client'
  if (includesAny(normalizedMessage, BRIEF_WORDS)) return 'brief'
  if (includesAny(normalizedMessage, DELIVERABLE_WORDS)) return 'deliverable'
  if (includesAny(normalizedMessage, TASK_WORDS)) return 'task'
  if (includesAny(normalizedMessage, CATEGORY_WORDS)) return 'category'
  if (includesAny(normalizedMessage, ROOM_WORDS)) return 'room'
  if (includesAny(normalizedMessage, CAMPAIGN_WORDS)) return 'campaign'
  return null
}

function getActionKind(message: string) {
  const lower = normalizeForMatch(message)
  if (hasPaymentDeadlineAlertIntent(lower)) return 'payment_alerts'
  if (hasMarkInvoicePaidIntent(lower)) return 'mark_invoice_paid'
  if (includesAny(lower, DELETE_WORDS)) {
    const deleteKind = deleteKindFromMessage(lower)
    return deleteKind ? `delete_${deleteKind}` : 'delete'
  }
  if (!includesAny(lower, CREATE_WORDS)) return null
  if (includesAny(lower, INVOICE_WORDS)) return 'invoice'
  if (includesAny(lower, BRIEF_WORDS)) return 'brief'
  if (includesAny(lower, CLIENT_WORDS)) return 'client'
  if (includesAny(lower, CAMPAIGN_WORDS)) return 'campaign'
  return null
}

async function loadLookups(companyId: string): Promise<WorkspaceLookups> {
  const [clients, projects, categories, managers, invoices, briefs, deliverables, tasks, rooms] = await Promise.all([
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
    prisma.user.findMany({
      where: {
        companyId,
        accountStatus: 'ACTIVE',
        role: { in: ['OWNER', 'MANAGER'] },
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
      take: 80,
    }),
    prisma.invoice.findMany({
      where: { companyId },
      select: {
        id: true,
        invoiceNumber: true,
        clientName: true,
        status: true,
        total: true,
        currency: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 150,
    }),
    prisma.brief.findMany({
      where: { companyId },
      select: { id: true, title: true, campaign: { select: { title: true } } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 150,
    }),
    prisma.deliverable.findMany({
      where: { companyId },
      select: { id: true, title: true, campaign: { select: { title: true } } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 150,
    }),
    prisma.task.findMany({
      where: { project: { companyId } },
      select: { id: true, title: true, project: { select: { title: true } } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 150,
    }),
    prisma.room.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 100,
    }),
  ])

  return { clients, projects, categories, managers, invoices, briefs, deliverables, tasks, rooms }
}

function compactDetails(values: Array<string | null | undefined>) {
  return values.map((value) => cleanText(value ?? '')).filter(Boolean).join(' / ')
}

function recordsFromLookups(lookups: WorkspaceLookups): IntentRecordCandidate[] {
  return [
    ...lookups.clients.map((client) => ({
      id: client.id,
      entity: 'client' as const,
      label: client.companyName,
      details: compactDetails([client.email, client.address]) || 'Client',
      aliases: [client.email ?? ''],
    })),
    ...lookups.projects.map((project) => ({
      id: project.id,
      entity: 'campaign' as const,
      label: project.title,
      details: compactDetails([project.clientName]) || 'Campaign',
      aliases: [project.clientName ?? ''],
    })),
    ...lookups.invoices.map((invoice) => ({
      id: invoice.id,
      entity: 'invoice' as const,
      label: `${invoice.invoiceNumber} - ${invoice.clientName}`,
      details: compactDetails([invoice.status, formatActionMoney(Number(invoice.total), invoice.currency), formatActionDate(invoice.dueDate)]),
      aliases: [invoice.invoiceNumber, invoice.clientName],
    })),
    ...lookups.briefs.map((brief) => ({
      id: brief.id,
      entity: 'brief' as const,
      label: brief.title,
      details: `Campaign: ${brief.campaign.title}`,
      aliases: [brief.campaign.title],
    })),
    ...lookups.deliverables.map((deliverable) => ({
      id: deliverable.id,
      entity: 'deliverable' as const,
      label: deliverable.title,
      details: `Campaign: ${deliverable.campaign.title}`,
      aliases: [deliverable.campaign.title],
    })),
    ...lookups.tasks.map((task) => ({
      id: task.id,
      entity: 'task' as const,
      label: task.title,
      details: `Campaign: ${task.project.title}`,
      aliases: [task.project.title],
    })),
  ]
}

function actionKindFromResolvedIntent(intent: ResolvedIntent): string | null {
  if (intent.type === 'CREATE_RECORD' && intent.entity) return intent.entity
  if (intent.type === 'DELETE_RECORD' && intent.entity) return `delete_${intent.entity}`
  if (intent.type === 'MARK_PAID') return 'mark_invoice_paid'
  if (intent.type === 'SEND_ALERT') {
    const canonicalInput = typeof intent.params.canonicalInput === 'string' ? intent.params.canonicalInput : intent.normalizedInput
    return /payment|invoice|deadline|due|paiement|facture|دفع|سداد|فاتورة/.test(canonicalInput) ? 'payment_alerts' : null
  }
  return null
}

function isPotentialActionIntent(intent: ResolvedIntent) {
  return intent.type === 'CREATE_RECORD' || intent.type === 'UPDATE_RECORD' || intent.type === 'DELETE_RECORD' || intent.type === 'MARK_PAID' || intent.type === 'SEND_ALERT'
}

function canonicalPromptForAction(intent: ResolvedIntent, fallback: string) {
  return typeof intent.params.canonicalInput === 'string' && intent.params.canonicalInput.trim()
    ? intent.params.canonicalInput
    : fallback
}

function ambiguityActionAnswer(intent: ResolvedIntent): AiActionResult {
  const panel = intent.ambiguityPanel
  if (!panel) return { handled: false, resolvedIntent: intent }

  return {
    handled: true,
    intent: intent.type.toLowerCase(),
    confidence: 'medium',
    answer: panel.question,
    citations: [],
    quickActions: [],
    facts: {
      ambiguous: true,
      entity: intent.entity,
      options: panel.options.map((option) => ({ id: option.id, label: option.label })),
    },
    ambiguity: panel,
    resolvedIntent: intent,
  }
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

function forbiddenAdminActionAnswer(intent: string, action: string) {
  return {
    handled: true,
    intent,
    confidence: 'high' as const,
    answer: [
      '**Direct Answer**',
      `I cannot ${action} for your current role.`,
      '',
      '**Access Required**',
      '- This AI action is limited to workspace Owners and Managers.',
    ].join('\n'),
    citations: [],
    quickActions: ['Analyze delayed projects', 'Find overdue invoices'],
    facts: { forbidden: true },
  }
}

function missingTargetAnswer(intent: string, subject: string, examples: string[] = []) {
  return {
    handled: true,
    intent,
    confidence: 'high' as const,
    answer: [
      '**Direct Answer**',
      `I can ${intent.startsWith('delete') ? 'delete' : 'update'} that ${subject}, but I need a specific ${subject} name, number, or ID first.`,
      '',
      '**Required Field**',
      `- ${subject} name, number, or ID`,
      examples.length ? '' : '',
      examples.length ? '**Available Examples**' : '',
      ...examples.map((example) => `- ${example}`),
    ].filter(Boolean).join('\n'),
    citations: [],
    quickActions: ['Find overdue invoices', 'Create invoice', 'Analyze delayed projects'],
    facts: { missingTarget: subject, examples },
  }
}

function ambiguousTargetAnswer(intent: string, subject: string, options: string[]) {
  return {
    handled: true,
    intent,
    confidence: 'high' as const,
    answer: [
      '**Direct Answer**',
      `I found more than one ${subject} that could match your prompt.`,
      '',
      '**Choose One**',
      ...options.map((option) => `- ${option}`),
      '',
      '**Next Step**',
      `Send the exact ${subject} name, number, or ID and I will run the action.`,
    ].join('\n'),
    citations: [],
    quickActions: ['Find overdue invoices', 'Analyze delayed projects'],
    facts: { ambiguousTarget: subject, options },
  }
}

function intentForActionKind(kind: string) {
  if (kind === 'client') return 'create_client'
  if (kind === 'campaign') return 'create_campaign'
  if (kind === 'brief') return 'create_brief'
  if (kind === 'invoice') return 'create_invoice'
  return kind
}

function confirmationUnavailableAnswer(reason: 'missing' | 'expired' | 'used' | 'forbidden'): AiActionResult {
  const message =
    reason === 'expired'
      ? 'That AI action confirmation token has expired. Run the request again to generate a fresh preview.'
      : reason === 'used'
        ? 'That AI action confirmation token was already used or cancelled. Run the request again if you need a new execution.'
        : reason === 'forbidden'
          ? 'That AI action confirmation belongs to a different actor or workspace, so I cannot execute it.'
          : 'I could not find a pending AI action for that confirmation token.'

  return {
    handled: true,
    intent: 'ai_action_confirmation',
    confidence: 'high',
    answer: [
      '**Confirmation Not Executed**',
      message,
      '',
      '**Governance**',
      '- No workspace data was changed.',
      '- Generate a new preview before attempting execution again.',
    ].join('\n'),
    citations: [],
    quickActions: ['Detect operational risks', 'Analyze delayed projects'],
    facts: { confirmationFailed: true, reason },
  }
}

async function governedPreview(input: {
  user: AiSessionUser
  kind: string
  rawMessage: string
  canonicalMessage: string
  conversationId?: string | null
  preview: AiActionPreviewPayload
  citations?: AiCitation[]
  quickActions?: string[]
}) {
  if (!input.user.companyId) return missingDetailsAnswer(input.kind, ['an active workspace'])
  const tool = getAiToolForActionKind(input.kind)
  if (!tool) {
    return {
      handled: true,
      intent: 'action_error',
      confidence: 'low' as const,
      answer: 'I found an action intent, but no governed AI tool is registered for it yet.',
      citations: [],
      quickActions: ['Detect operational risks', 'Analyze delayed projects'],
      facts: { missingTool: input.kind },
    }
  }

  const created = await createAiActionPreview({
    companyId: input.user.companyId,
    actorId: input.user.id,
    conversationId: input.conversationId ?? null,
    tool,
    actionKind: input.kind,
    rawMessage: input.rawMessage,
    canonicalMessage: input.canonicalMessage,
    preview: input.preview,
  })

  return {
    handled: true,
    intent: intentForActionKind(input.kind),
    confidence: 'high' as const,
    answer: createPreviewAnswer(created.card),
    citations: input.citations ?? [],
    quickActions: input.quickActions ?? ['Detect operational risks', 'Analyze delayed projects'],
    facts: {
      dryRun: true,
      confirmationRequired: true,
      actionPreview: created.card,
    },
    actionPreview: created.card,
  }
}

function fieldsFromObject(value: Record<string, unknown>) {
  return Object.entries(value)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
    .map(([key, val]) => `${key}: ${val}`)
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

  const clientId = extractLabeledValue(input.message, ['client id', 'clientId'])
  const categoryId = extractLabeledValue(input.message, ['category id', 'categoryId'])
  const managerId = extractLabeledValue(input.message, ['manager id', 'managerId'])
  const client = findById(input.lookups.clients, clientId) ?? findBestByName(input.lookups.clients, input.message)
  const requestedClientName = extractLabeledValue(input.message, ['client', 'client name', 'customer', 'customer name'])
  const category = findById(input.lookups.categories, categoryId) ?? findBestByName(input.lookups.categories, input.message) ?? (input.lookups.categories.length === 1 ? input.lookups.categories[0] : null)
  const manager = findById(input.lookups.managers, managerId)
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
      managerId: manager?.id ?? input.user.id,
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
      manager ? `Manager: ${manager.name}` : '',
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

  const campaignId = extractLabeledValue(input.message, ['campaign id', 'campaignId', 'project id', 'projectId'])
  const campaign = findById(input.lookups.projects, campaignId) ?? findBestByName(input.lookups.projects, input.message) ?? (input.lookups.projects.length === 1 ? input.lookups.projects[0] : null)
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

  const clientId = extractLabeledValue(input.message, ['client id', 'clientId'])
  const campaignId = extractLabeledValue(input.message, ['campaign id', 'campaignId', 'project id', 'projectId'])
  const client = findById(input.lookups.clients, clientId) ?? findBestByName(input.lookups.clients, input.message)
  const campaign = findById(input.lookups.projects, campaignId) ?? findBestByName(input.lookups.projects, input.message)
  const amount = extractMoney(input.message)
  if (!client && !campaign?.clientName) return missingDetailsAnswer('invoice', ['a client name'])
  if (!amount) return missingDetailsAnswer('invoice', ['an invoice amount such as "$1200"'])

  const clientName = client?.companyName ?? campaign?.clientName ?? ''
  const currency = extractCurrency(input.message)
  const itemDescription = extractLabeledValue(input.message, ['line item', 'item', 'description']) || extractTitle(input.message, 'invoice') || `Services for ${campaign?.title ?? clientName}`
  const invoiceLocale = extractLabeledValue(input.message, ['invoice locale', 'locale', 'language'])
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
      locale: invoiceLocale === 'ar' ? 'ar' : 'en',
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
  const status = extractLabeledValue(input.message, ['status'])?.toLowerCase() === 'inactive' ? 'inactive' : 'active'

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
      status,
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
      `- Status: ${status}`,
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

async function markInvoicePaid(input: {
  message: string
  user: AiSessionUser
  lookups: WorkspaceLookups
}) {
  if (!input.user.companyId) return missingDetailsAnswer('invoice payment', ['an active workspace'])
  if (!canManageInvoices(input.user)) return forbiddenAdminActionAnswer('mark_invoice_paid', 'mark invoices as paid')
  const companyId = input.user.companyId

  const target = resolveInvoiceTarget(input.lookups.invoices, input.message)
  if (target.status === 'missing') return missingTargetAnswer('mark_invoice_paid', 'invoice', target.examples)
  if (target.status === 'ambiguous') return ambiguousTargetAnswer('mark_invoice_paid', 'invoice', target.options)

  const existing = await prisma.invoice.findFirst({
    where: { id: target.item.id, companyId },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      client: { select: { id: true, companyName: true } },
      campaign: { select: { id: true, title: true } },
    },
  })
  if (!existing) return missingTargetAnswer('mark_invoice_paid', 'invoice', input.lookups.invoices.slice(0, 5).map((invoice) => `${invoice.invoiceNumber} - ${invoice.clientName}`))

  if (existing.status === 'paid') {
    return {
      handled: true,
      intent: 'mark_invoice_paid',
      confidence: 'high' as const,
      answer: [
        '**Direct Answer**',
        `${existing.invoiceNumber} is already marked paid.`,
        '',
        '**Invoice**',
        `- Client: ${existing.clientName}`,
        `- Total: ${formatActionMoney(Number(existing.total), existing.currency)}`,
        existing.paidAt ? `- Paid at: ${formatActionDate(existing.paidAt)}` : '',
      ].filter(Boolean).join('\n'),
      citations: [{ type: 'invoice' as const, id: existing.id, label: `${existing.invoiceNumber} - ${existing.clientName}`, href: '/dashboard/admin/invoices' }],
      quickActions: ['Find overdue invoices', 'Create invoice', 'Send payment deadline alerts'],
      facts: { invoiceId: existing.id, invoiceNumber: existing.invoiceNumber, alreadyPaid: true },
    }
  }

  const paidAt = new Date()
  const invoice = await prisma.$transaction(async (tx) => {
    const updated = await tx.invoice.update({
      where: { id: existing.id },
      data: {
        status: 'paid',
        paidAt,
        sentAt: existing.sentAt ?? paidAt,
      },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        client: { select: { id: true, companyName: true } },
        campaign: { select: { id: true, title: true } },
      },
    })

    await tx.adminActionLog.create({
      data: {
        companyId,
        actorId: input.user.id,
        action: 'ai.invoice.mark_paid',
        metadata: {
          prompt: input.message.slice(0, 500),
          invoiceId: existing.id,
          invoiceNumber: existing.invoiceNumber,
          previousStatus: existing.status,
          nextStatus: 'paid',
        },
      },
    })

    return updated
  })

  const serialized = serializeInvoice(invoice)
  emitCompanyRealtime(companyId, 'invoice_updated', { invoice: serialized })

  return {
    handled: true,
    intent: 'mark_invoice_paid',
    confidence: 'high' as const,
    answer: [
      '**Direct Answer**',
      `Invoice marked paid: ${invoice.invoiceNumber}`,
      '',
      '**Payment Update**',
      `- Client: ${invoice.clientName}`,
      `- Total: ${formatActionMoney(Number(invoice.total), invoice.currency)}`,
      `- Paid at: ${formatActionDate(invoice.paidAt)}`,
      '',
      '**Governance**',
      '- The action was recorded in the admin action log.',
    ].join('\n'),
    citations: [{ type: 'invoice' as const, id: invoice.id, label: `${invoice.invoiceNumber} - ${invoice.clientName}`, href: '/dashboard/admin/invoices' }],
    quickActions: ['Find overdue invoices', 'Create invoice', 'Send payment deadline alerts'],
    facts: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, status: invoice.status },
  }
}

function resolveDeleteTarget(kind: DeletableKind, lookups: WorkspaceLookups, message: string): ResolvedTarget<{ id: string }> {
  if (kind === 'invoice') return resolveInvoiceTarget(lookups.invoices, message)
  if (kind === 'client') return resolveTarget(lookups.clients, message, ['client id', 'clientId', 'id'], (client) => [client.companyName, client.email])
  if (kind === 'campaign') return resolveTarget(lookups.projects, message, ['campaign id', 'campaignId', 'project id', 'projectId', 'id'], (project) => [project.title, project.clientName])
  if (kind === 'brief') return resolveTarget(lookups.briefs, message, ['brief id', 'briefId', 'id'], (brief) => [brief.title, brief.campaign.title])
  if (kind === 'deliverable') return resolveTarget(lookups.deliverables, message, ['deliverable id', 'deliverableId', 'id'], (deliverable) => [deliverable.title, deliverable.campaign.title])
  if (kind === 'task') return resolveTarget(lookups.tasks, message, ['task id', 'taskId', 'id'], (task) => [task.title, task.project.title])
  if (kind === 'category') return resolveTarget(lookups.categories, message, ['category id', 'categoryId', 'id'], (category) => [category.name])
  return resolveTarget(lookups.rooms, message, ['room id', 'roomId', 'id'], (room) => [room.name])
}

function deleteSubjectLabel(kind: DeletableKind) {
  if (kind === 'campaign') return 'campaign/project'
  return kind
}

function deleteTargetLabel(kind: DeletableKind, target: { id: string }, lookups: WorkspaceLookups) {
  if (kind === 'invoice') {
    const invoice = lookups.invoices.find((item) => item.id === target.id)
    return invoice ? `${invoice.invoiceNumber} - ${invoice.clientName}` : target.id
  }
  if (kind === 'client') return lookups.clients.find((item) => item.id === target.id)?.companyName ?? target.id
  if (kind === 'campaign') return lookups.projects.find((item) => item.id === target.id)?.title ?? target.id
  if (kind === 'brief') return lookups.briefs.find((item) => item.id === target.id)?.title ?? target.id
  if (kind === 'deliverable') return lookups.deliverables.find((item) => item.id === target.id)?.title ?? target.id
  if (kind === 'task') return lookups.tasks.find((item) => item.id === target.id)?.title ?? target.id
  if (kind === 'category') return lookups.categories.find((item) => item.id === target.id)?.name ?? target.id
  return lookups.rooms.find((item) => item.id === target.id)?.name ?? target.id
}

async function deleteWorkspaceRecord(input: {
  message: string
  user: AiSessionUser
  lookups: WorkspaceLookups
  kind: DeletableKind
}) {
  if (!input.user.companyId) return missingDetailsAnswer(input.kind, ['an active workspace'])
  if (!canManageOperations(input.user)) return forbiddenAdminActionAnswer(`delete_${input.kind}`, `delete ${deleteSubjectLabel(input.kind)} records`)
  const companyId = input.user.companyId

  const target = resolveDeleteTarget(input.kind, input.lookups, input.message)
  const subject = deleteSubjectLabel(input.kind)
  if (target.status === 'missing') return missingTargetAnswer(`delete_${input.kind}`, subject, target.examples)
  if (target.status === 'ambiguous') return ambiguousTargetAnswer(`delete_${input.kind}`, subject, target.options)

  const label = deleteTargetLabel(input.kind, target.item, input.lookups)

  await prisma.$transaction(async (tx) => {
    if (input.kind === 'invoice') {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: target.item.id } })
      await tx.invoice.deleteMany({ where: { id: target.item.id, companyId } })
    } else if (input.kind === 'client') {
      await deleteClientGraph(tx, target.item.id)
    } else if (input.kind === 'campaign') {
      await deleteProjectGraph(tx, target.item.id)
    } else if (input.kind === 'task') {
      await deleteTasksById(tx, [target.item.id])
    } else if (input.kind === 'brief') {
      await tx.brief.deleteMany({ where: { id: target.item.id, companyId } })
    } else if (input.kind === 'deliverable') {
      await tx.deliverable.deleteMany({ where: { id: target.item.id, companyId } })
    } else if (input.kind === 'category') {
      await tx.projectCategory.deleteMany({ where: { id: target.item.id, companyId } })
    } else {
      await tx.room.deleteMany({ where: { id: target.item.id, companyId } })
    }

    await tx.adminActionLog.create({
      data: {
        companyId,
        actorId: input.user.id,
        action: `ai.delete.${input.kind}`,
        metadata: {
          prompt: input.message.slice(0, 500),
          entityType: input.kind,
          entityId: target.item.id,
          label,
        },
      },
    })
  })

  if (input.kind === 'invoice') {
    emitCompanyRealtime(companyId, 'invoice_deleted', { invoiceId: target.item.id })
  } else if (input.kind === 'client') {
    emitCompanyRealtime(companyId, 'client_deleted', { clientId: target.item.id })
  } else if (input.kind === 'campaign') {
    emitCompanyRealtime(companyId, 'project_deleted', { projectId: target.item.id })
  } else if (input.kind === 'task') {
    emitCompanyRealtime(companyId, 'task_deleted', { taskId: target.item.id })
  } else {
    emitCompanyRealtime(companyId, 'workspace_event', {
      type: `${input.kind}_deleted`,
      entityType: input.kind,
      entityId: target.item.id,
      label,
    })
  }

  return {
    handled: true,
    intent: `delete_${input.kind}`,
    confidence: 'high' as const,
    answer: [
      '**Direct Answer**',
      `${subject} deleted: ${label}`,
      '',
      '**Governance**',
      '- The action was limited to this workspace.',
      '- The deletion was recorded in the admin action log.',
    ].join('\n'),
    citations: [],
    quickActions: ['Analyze delayed projects', 'Find overdue invoices', 'Create campaign', 'Create client'],
    facts: { deleted: true, entityType: input.kind, entityId: target.item.id, label },
  }
}

async function previewCreateCampaign(input: {
  rawMessage: string
  message: string
  user: AiSessionUser
  lookups: WorkspaceLookups
  conversationId?: string | null
}) {
  if (!input.user.companyId) return missingDetailsAnswer('campaign', ['an active workspace'])
  if (!canManageOperations(input.user)) return forbiddenAdminActionAnswer('create_campaign', 'create campaigns')

  const title = extractTitle(input.message, 'campaign')
  if (!title || title.length < 3) return missingDetailsAnswer('campaign', ['a campaign name'])

  const clientId = extractLabeledValue(input.message, ['client id', 'clientId'])
  const categoryId = extractLabeledValue(input.message, ['category id', 'categoryId'])
  const managerId = extractLabeledValue(input.message, ['manager id', 'managerId'])
  const client = findById(input.lookups.clients, clientId) ?? findBestByName(input.lookups.clients, input.message)
  const requestedClientName = extractLabeledValue(input.message, ['client', 'client name', 'customer', 'customer name'])
  const category = findById(input.lookups.categories, categoryId) ?? findBestByName(input.lookups.categories, input.message) ?? (input.lookups.categories.length === 1 ? input.lookups.categories[0] : null)
  const manager = findById(input.lookups.managers, managerId)
  if (input.lookups.categories.length > 1 && !category) {
    return missingDetailsAnswer('campaign', [`one category (${input.lookups.categories.map((item) => item.name).slice(0, 5).join(', ')})`])
  }

  const fields = {
    Campaign: title,
    Client: client?.companyName ?? requestedClientName ?? '',
    Category: category?.name ?? '',
    Manager: manager?.name ?? input.user.name ?? 'Current user',
    Description: extractDescription(input.message) ?? '',
  }

  return governedPreview({
    user: input.user,
    kind: 'campaign',
    rawMessage: input.rawMessage,
    canonicalMessage: input.message,
    conversationId: input.conversationId,
    preview: {
      summary: `Create campaign "${title}"${client?.companyName ? ` for ${client.companyName}` : requestedClientName ? ` for ${requestedClientName}` : ''}.`,
      changes: [
        'Create a new campaign/project in this workspace.',
        'Initialize a starter campaign brief for the delivery team.',
        ...fieldsFromObject(fields).map((field) => `Set ${field}.`),
      ],
      warnings: ['No campaign will be created until this preview is confirmed.'],
      targetType: 'project',
      targetLabel: title,
      diff: {
        before: null,
        after: {
          title,
          clientId: client?.id ?? null,
          clientName: client?.companyName ?? requestedClientName ?? null,
          categoryId: category?.id ?? null,
          managerId: manager?.id ?? input.user.id,
          hasCamera: false,
        },
      },
      rollback: {
        strategy: 'metadata_snapshot',
        proposedEntity: 'project',
        title,
        linkedClientId: client?.id ?? null,
      },
    },
    citations: client ? [{ type: 'client', id: client.id, label: client.companyName, href: `/dashboard/admin/clients/${client.id}` }] : [],
    quickActions: ['Create brief', 'Create invoice', 'Analyze delayed projects'],
  })
}

async function previewCreateBrief(input: {
  rawMessage: string
  message: string
  user: AiSessionUser
  lookups: WorkspaceLookups
  conversationId?: string | null
}) {
  if (!input.user.companyId) return missingDetailsAnswer('brief', ['an active workspace'])
  if (!canManageOperations(input.user)) return forbiddenAdminActionAnswer('create_brief', 'create briefs')

  const campaignId = extractLabeledValue(input.message, ['campaign id', 'campaignId', 'project id', 'projectId'])
  const campaign = findById(input.lookups.projects, campaignId) ?? findBestByName(input.lookups.projects, input.message) ?? (input.lookups.projects.length === 1 ? input.lookups.projects[0] : null)
  if (!campaign) return missingDetailsAnswer('brief', ['the campaign name'])

  const title = extractTitle(input.message, 'brief') || `${campaign.title} brief`
  const description = extractDescription(input.message) ?? input.message

  return governedPreview({
    user: input.user,
    kind: 'brief',
    rawMessage: input.rawMessage,
    canonicalMessage: input.message,
    conversationId: input.conversationId,
    preview: {
      summary: `Create draft brief "${title}" for ${campaign.title}.`,
      changes: [
        'Create a draft campaign brief.',
        `Link the brief to campaign: ${campaign.title}.`,
        campaign.clientName ? `Carry over client context: ${campaign.clientName}.` : 'No client link will be added unless the campaign has one.',
        'Set description from the confirmed AI instruction.',
      ],
      warnings: ['The brief remains in DRAFT status after execution.'],
      targetType: 'brief',
      targetLabel: title,
      diff: {
        before: null,
        after: {
          title,
          campaignId: campaign.id,
          clientId: campaign.clientId,
          description,
          status: 'DRAFT',
        },
      },
      rollback: {
        strategy: 'metadata_snapshot',
        proposedEntity: 'brief',
        title,
        campaignId: campaign.id,
      },
    },
    citations: [{ type: 'project', id: campaign.id, label: campaign.title, href: `/dashboard/admin/projects/${campaign.id}` }],
    quickActions: ['Create campaign', 'Create invoice', 'Summarize pending approvals'],
  })
}

async function previewCreateInvoice(input: {
  rawMessage: string
  message: string
  user: AiSessionUser
  lookups: WorkspaceLookups
  conversationId?: string | null
}) {
  if (!input.user.companyId) return missingDetailsAnswer('invoice', ['an active workspace'])
  if (!canManageInvoices(input.user)) return forbiddenAdminActionAnswer('create_invoice', 'create invoices')

  const clientId = extractLabeledValue(input.message, ['client id', 'clientId'])
  const campaignId = extractLabeledValue(input.message, ['campaign id', 'campaignId', 'project id', 'projectId'])
  const client = findById(input.lookups.clients, clientId) ?? findBestByName(input.lookups.clients, input.message)
  const campaign = findById(input.lookups.projects, campaignId) ?? findBestByName(input.lookups.projects, input.message)
  const amount = extractMoney(input.message)
  if (!client && !campaign?.clientName) return missingDetailsAnswer('invoice', ['a client name'])
  if (!amount) return missingDetailsAnswer('invoice', ['an invoice amount such as "$1200"'])

  const clientName = client?.companyName ?? campaign?.clientName ?? ''
  const currency = extractCurrency(input.message)
  const itemDescription = extractLabeledValue(input.message, ['line item', 'item', 'description']) || extractTitle(input.message, 'invoice') || `Services for ${campaign?.title ?? clientName}`
  const rawItems: InvoiceItemInput[] = [{ description: itemDescription, quantity: 1, unitPrice: amount }]
  const totals = calculateInvoiceTotals(rawItems, 0)
  if (totals.items.length === 0) return missingDetailsAnswer('invoice', ['a line-item description'])

  const invoiceNumber = await nextInvoiceNumber(input.user.companyId)
  const dueDate = extractDueDate(input.message)
  const totalLabel = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(totals.totalCents / 100)

  return governedPreview({
    user: input.user,
    kind: 'invoice',
    rawMessage: input.rawMessage,
    canonicalMessage: input.message,
    conversationId: input.conversationId,
    preview: {
      summary: `Create draft invoice ${invoiceNumber} for ${clientName} totaling ${totalLabel}.`,
      changes: [
        `Create a draft invoice for ${clientName}.`,
        `Add line item: ${itemDescription}.`,
        `Set total to ${totalLabel}.`,
        dueDate ? `Set due date to ${dueDate}.` : 'Leave due date empty.',
        campaign ? `Link invoice to campaign: ${campaign.title}.` : 'Do not link a campaign.',
      ],
      warnings: [
        'Financial data will not be changed until confirmed.',
        'The invoice number is provisional and may advance if another invoice is created before confirmation.',
      ],
      targetType: 'invoice',
      targetLabel: invoiceNumber,
      diff: {
        before: null,
        after: {
          invoiceNumber,
          clientId: client?.id ?? campaign?.clientId ?? null,
          campaignId: campaign?.id ?? null,
          clientName,
          status: 'draft',
          currency,
          dueDate,
          subtotal: totals.subtotalCents / 100,
          taxTotal: totals.taxTotalCents / 100,
          total: totals.totalCents / 100,
          items: totals.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPriceCents / 100,
            lineTotal: item.lineTotalCents / 100,
          })),
        },
      },
      rollback: {
        strategy: 'metadata_snapshot',
        proposedEntity: 'invoice',
        invoiceNumber,
        total: totals.totalCents / 100,
        currency,
      },
    },
    citations: client
      ? [{ type: 'client', id: client.id, label: client.companyName, href: `/dashboard/admin/clients/${client.id}` }]
      : campaign
        ? [{ type: 'project', id: campaign.id, label: campaign.title, href: `/dashboard/admin/projects/${campaign.id}` }]
        : [],
    quickActions: ['Find overdue invoices', 'Create campaign', 'Generate weekly report'],
  })
}

async function previewCreateClient(input: {
  rawMessage: string
  message: string
  user: AiSessionUser
  conversationId?: string | null
}) {
  if (!input.user.companyId) return missingDetailsAnswer('client', ['an active workspace'])
  if (!canManageOperations(input.user)) return forbiddenAdminActionAnswer('create_client', 'create clients')

  const companyName = extractClientName(input.message)
  if (!companyName || companyName.length < 2) return missingDetailsAnswer('client', ['a client or company name'])

  const email = extractLabeledValue(input.message, ['email', 'client email'])
  const contactPerson = extractLabeledValue(input.message, ['contact person', 'contact'])
  const phone = extractLabeledValue(input.message, ['phone', 'phone number'])
  const country = extractLabeledValue(input.message, ['country'])
  const address = extractLabeledValue(input.message, ['address'])
  const notes = extractLabeledValue(input.message, ['notes', 'note'])
  const status = extractLabeledValue(input.message, ['status'])?.toLowerCase() === 'inactive' ? 'inactive' : 'active'

  const fields = {
    Client: companyName,
    Contact: contactPerson ?? '',
    Email: email?.toLowerCase() ?? '',
    Phone: phone ?? '',
    Country: country ?? '',
    Status: status,
  }

  return governedPreview({
    user: input.user,
    kind: 'client',
    rawMessage: input.rawMessage,
    canonicalMessage: input.message,
    conversationId: input.conversationId,
    preview: {
      summary: `Create client profile for ${companyName}.`,
      changes: [
        'Create a new client profile in this workspace.',
        'Create initial client activity records for auditability.',
        ...fieldsFromObject(fields).map((field) => `Set ${field}.`),
      ],
      warnings: ['No client profile will be created until this preview is confirmed.'],
      targetType: 'client',
      targetLabel: companyName,
      diff: {
        before: null,
        after: {
          companyName,
          contactPerson,
          email: email?.toLowerCase() ?? null,
          phone,
          country,
          address,
          notes,
          status,
        },
      },
      rollback: {
        strategy: 'metadata_snapshot',
        proposedEntity: 'client',
        companyName,
      },
    },
    quickActions: ['Create campaign', 'Create brief', 'Create invoice'],
  })
}

async function previewPaymentDeadlineAlerts(input: {
  rawMessage: string
  message: string
  user: AiSessionUser
  conversationId?: string | null
}) {
  if (!input.user.companyId) return missingDetailsAnswer('payment alert', ['an active workspace'])
  if (!canManageInvoices(input.user)) return forbiddenAdminActionAnswer('payment_deadline_alerts', 'send payment-deadline alerts')

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
      facts: { alertsSent: 0, invoiceCount: 0, dryRun: true },
    }
  }

  const recipients = await prisma.user.findMany({
    where: {
      companyId: input.user.companyId,
      role: { in: ['OWNER', 'MANAGER'] },
      accountStatus: 'ACTIVE',
    },
    select: { id: true, name: true },
    take: 100,
  })
  const alertRecipients = recipients.length ? recipients : [{ id: input.user.id, name: input.user.name ?? 'Current user' }]
  const today = startOfDay(now)
  let suppressedDuplicates = 0

  for (const invoice of invoices) {
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
      if (existing) suppressedDuplicates += 1
    }
  }

  const alertCount = invoices.length * alertRecipients.length - suppressedDuplicates
  const visibleInvoices = invoices.slice(0, 6)

  return governedPreview({
    user: input.user,
    kind: 'payment_alerts',
    rawMessage: input.rawMessage,
    canonicalMessage: input.message,
    conversationId: input.conversationId,
    preview: {
      summary: `Send ${alertCount} payment-deadline alert${alertCount === 1 ? '' : 's'} for ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}.`,
      changes: [
        `Create in-app alerts for ${alertRecipients.length} active Owner/Manager recipient${alertRecipients.length === 1 ? '' : 's'}.`,
        `Cover ${invoices.length} sent or overdue invoice${invoices.length === 1 ? '' : 's'} due within 7 days or already overdue.`,
        suppressedDuplicates ? `Suppress ${suppressedDuplicates} duplicate alert${suppressedDuplicates === 1 ? '' : 's'} already created today.` : 'No duplicate alerts were found for today.',
      ],
      warnings: [
        'Notifications are user-visible after execution.',
        'No alerts have been created during this dry run.',
      ],
      targetType: 'invoice',
      diff: {
        before: { alertsCreated: 0 },
        after: {
          alertsToCreate: alertCount,
          invoiceIds: invoices.map((invoice) => invoice.id),
          recipientIds: alertRecipients.map((recipient) => recipient.id),
          duplicatesSuppressed: suppressedDuplicates,
        },
      },
      rollback: {
        strategy: 'manual_review',
        notes: 'Executed notification artifacts are not automatically recalled.',
      },
    },
    citations: visibleInvoices.map((invoice) => ({
      type: 'invoice' as const,
      id: invoice.id,
      label: `${invoice.invoiceNumber} - ${invoice.clientName}`,
      href: '/dashboard/admin/invoices',
    })),
    quickActions: ['Find overdue invoices', 'Create invoice', 'Analyze delayed projects'],
  })
}

async function previewMarkInvoicePaid(input: {
  rawMessage: string
  message: string
  user: AiSessionUser
  lookups: WorkspaceLookups
  conversationId?: string | null
}) {
  if (!input.user.companyId) return missingDetailsAnswer('invoice payment', ['an active workspace'])
  if (!canManageInvoices(input.user)) return forbiddenAdminActionAnswer('mark_invoice_paid', 'mark invoices as paid')
  const companyId = input.user.companyId

  const target = resolveInvoiceTarget(input.lookups.invoices, input.message)
  if (target.status === 'missing') return missingTargetAnswer('mark_invoice_paid', 'invoice', target.examples)
  if (target.status === 'ambiguous') return ambiguousTargetAnswer('mark_invoice_paid', 'invoice', target.options)

  const existing = await prisma.invoice.findFirst({
    where: { id: target.item.id, companyId },
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      status: true,
      total: true,
      currency: true,
      paidAt: true,
      sentAt: true,
    },
  })
  if (!existing) return missingTargetAnswer('mark_invoice_paid', 'invoice', input.lookups.invoices.slice(0, 5).map((invoice) => `${invoice.invoiceNumber} - ${invoice.clientName}`))

  if (existing.status === 'paid') {
    return {
      handled: true,
      intent: 'mark_invoice_paid',
      confidence: 'high' as const,
      answer: [
        '**Direct Answer**',
        `${existing.invoiceNumber} is already marked paid.`,
        '',
        '**Governance**',
        '- No confirmation is required because no mutation is needed.',
      ].join('\n'),
      citations: [{ type: 'invoice' as const, id: existing.id, label: `${existing.invoiceNumber} - ${existing.clientName}`, href: '/dashboard/admin/invoices' }],
      quickActions: ['Find overdue invoices', 'Create invoice', 'Send payment deadline alerts'],
      facts: { invoiceId: existing.id, invoiceNumber: existing.invoiceNumber, alreadyPaid: true, dryRun: true },
    }
  }

  return governedPreview({
    user: input.user,
    kind: 'mark_invoice_paid',
    rawMessage: input.rawMessage,
    canonicalMessage: input.message,
    conversationId: input.conversationId,
    preview: {
      summary: `Mark invoice ${existing.invoiceNumber} as paid.`,
      changes: [
        `Change invoice status from ${existing.status} to paid.`,
        'Set paidAt to the execution timestamp.',
        existing.sentAt ? 'Keep the existing sentAt timestamp.' : 'Set sentAt to the execution timestamp because it is currently empty.',
      ],
      warnings: [
        'This changes financial reporting and payment status.',
        'No invoice has been updated during this dry run.',
      ],
      targetType: 'invoice',
      targetId: existing.id,
      targetLabel: `${existing.invoiceNumber} - ${existing.clientName}`,
      diff: {
        before: {
          status: existing.status,
          paidAt: existing.paidAt?.toISOString() ?? null,
          sentAt: existing.sentAt?.toISOString() ?? null,
        },
        after: {
          status: 'paid',
          paidAt: 'execution_timestamp',
          sentAt: existing.sentAt?.toISOString() ?? 'execution_timestamp',
        },
      },
      rollback: {
        strategy: 'metadata_snapshot',
        invoiceId: existing.id,
        invoiceNumber: existing.invoiceNumber,
        previousStatus: existing.status,
        previousPaidAt: existing.paidAt?.toISOString() ?? null,
        previousSentAt: existing.sentAt?.toISOString() ?? null,
      },
    },
    citations: [{ type: 'invoice' as const, id: existing.id, label: `${existing.invoiceNumber} - ${existing.clientName}`, href: '/dashboard/admin/invoices' }],
    quickActions: ['Find overdue invoices', 'Create invoice', 'Send payment deadline alerts'],
  })
}

async function deleteImpact(kind: DeletableKind, companyId: string, targetId: string) {
  if (kind === 'invoice') {
    const itemCount = await prisma.invoiceItem.count({ where: { invoiceId: targetId } })
    return [`Delete invoice and ${itemCount} line item${itemCount === 1 ? '' : 's'}.`]
  }

  if (kind === 'client') {
    const [projectLinks, invoiceLinks, briefLinks, activities] = await Promise.all([
      prisma.project.count({ where: { companyId, clientId: targetId } }),
      prisma.invoice.count({ where: { companyId, clientId: targetId } }),
      prisma.brief.count({ where: { companyId, clientId: targetId } }),
      prisma.clientActivity.count({ where: { companyId, clientId: targetId } }),
    ])
    return [
      'Delete the client profile.',
      `Unlink ${projectLinks} campaign${projectLinks === 1 ? '' : 's'}, ${invoiceLinks} invoice${invoiceLinks === 1 ? '' : 's'}, and ${briefLinks} brief${briefLinks === 1 ? '' : 's'} from this client.`,
      `Delete ${activities} client activity record${activities === 1 ? '' : 's'}.`,
    ]
  }

  if (kind === 'campaign') {
    const [tasks, briefs, deliverables, media, calendars] = await Promise.all([
      prisma.task.count({ where: { projectId: targetId } }),
      prisma.brief.count({ where: { companyId, campaignId: targetId } }),
      prisma.deliverable.count({ where: { companyId, campaignId: targetId } }),
      prisma.projectMedia.count({ where: { projectId: targetId } }),
      prisma.calendarEvent.count({ where: { companyId, projectId: targetId } }),
    ])
    return [
      'Delete the campaign/project record.',
      `Delete graph-linked delivery records: ${tasks} task${tasks === 1 ? '' : 's'}, ${briefs} brief${briefs === 1 ? '' : 's'}, ${deliverables} deliverable${deliverables === 1 ? '' : 's'}, ${media} media item${media === 1 ? '' : 's'}, and ${calendars} calendar event${calendars === 1 ? '' : 's'}.`,
      'Unlink related invoices from this campaign instead of deleting the invoices.',
    ]
  }

  if (kind === 'task') {
    const [subtasks, submissions] = await Promise.all([
      prisma.subtask.count({ where: { taskId: targetId } }),
      prisma.taskSubmission.count({ where: { taskId: targetId } }),
    ])
    return [`Delete the task plus ${subtasks} subtask${subtasks === 1 ? '' : 's'} and ${submissions} submission${submissions === 1 ? '' : 's'}.`]
  }

  return [`Delete the selected ${deleteSubjectLabel(kind)} if it still belongs to this workspace at execution time.`]
}

async function previewDeleteWorkspaceRecord(input: {
  rawMessage: string
  message: string
  user: AiSessionUser
  lookups: WorkspaceLookups
  kind: DeletableKind
  conversationId?: string | null
}) {
  if (!input.user.companyId) return missingDetailsAnswer(input.kind, ['an active workspace'])
  if (!canManageOperations(input.user)) return forbiddenAdminActionAnswer(`delete_${input.kind}`, `delete ${deleteSubjectLabel(input.kind)} records`)
  const companyId = input.user.companyId

  const target = resolveDeleteTarget(input.kind, input.lookups, input.message)
  const subject = deleteSubjectLabel(input.kind)
  if (target.status === 'missing') return missingTargetAnswer(`delete_${input.kind}`, subject, target.examples)
  if (target.status === 'ambiguous') return ambiguousTargetAnswer(`delete_${input.kind}`, subject, target.options)

  const label = deleteTargetLabel(input.kind, target.item, input.lookups)
  const impact = await deleteImpact(input.kind, companyId, target.item.id)

  return governedPreview({
    user: input.user,
    kind: `delete_${input.kind}`,
    rawMessage: input.rawMessage,
    canonicalMessage: input.message,
    conversationId: input.conversationId,
    preview: {
      summary: `Delete ${subject}: ${label}.`,
      changes: impact,
      warnings: [
        'This is a destructive action and cannot execute without confirmation.',
        'Rollback metadata will be recorded, but full restore may require backup recovery.',
        'The target will be rechecked inside the same workspace at execution time.',
      ],
      targetType: input.kind,
      targetId: target.item.id,
      targetLabel: label,
      diff: {
        before: {
          entityType: input.kind,
          entityId: target.item.id,
          label,
        },
        after: null,
      },
      rollback: {
        strategy: 'metadata_snapshot',
        entityType: input.kind,
        entityId: target.item.id,
        label,
        impact,
      },
    },
    quickActions: ['Analyze delayed projects', 'Find overdue invoices', 'Create campaign'],
  })
}

async function previewAiWorkspaceAction(input: {
  kind: string
  rawMessage: string
  actionMessage: string
  user: AiSessionUser
  lookups: WorkspaceLookups
  conversationId?: string | null
}): Promise<AiActionResult> {
  if (input.kind === 'client') return previewCreateClient({ rawMessage: input.rawMessage, message: input.actionMessage, user: input.user, conversationId: input.conversationId })
  if (input.kind === 'payment_alerts') return previewPaymentDeadlineAlerts({ rawMessage: input.rawMessage, message: input.actionMessage, user: input.user, conversationId: input.conversationId })
  if (input.kind === 'mark_invoice_paid') return previewMarkInvoicePaid({ rawMessage: input.rawMessage, message: input.actionMessage, user: input.user, lookups: input.lookups, conversationId: input.conversationId })
  if (input.kind.startsWith('delete_')) {
    const deleteKind = input.kind.replace('delete_', '') as DeletableKind
    return previewDeleteWorkspaceRecord({ rawMessage: input.rawMessage, message: input.actionMessage, user: input.user, lookups: input.lookups, kind: deleteKind, conversationId: input.conversationId })
  }
  if (input.kind === 'campaign') return previewCreateCampaign({ rawMessage: input.rawMessage, message: input.actionMessage, user: input.user, lookups: input.lookups, conversationId: input.conversationId })
  if (input.kind === 'brief') return previewCreateBrief({ rawMessage: input.rawMessage, message: input.actionMessage, user: input.user, lookups: input.lookups, conversationId: input.conversationId })
  if (input.kind === 'invoice') return previewCreateInvoice({ rawMessage: input.rawMessage, message: input.actionMessage, user: input.user, lookups: input.lookups, conversationId: input.conversationId })

  return { handled: false }
}

async function executeConfirmedAiWorkspaceAction(input: {
  confirmationToken: string
  user: AiSessionUser
}): Promise<AiActionResult> {
  if (!input.user.companyId) return missingDetailsAnswer('confirmed action', ['an active workspace'])

  const lookup = await loadAiActionForConfirmation({
    confirmationToken: input.confirmationToken,
    companyId: input.user.companyId,
    actorId: input.user.id,
  })
  if (!lookup.ok) return confirmationUnavailableAnswer(lookup.reason)

  const storedInput = parseStoredActionInput(lookup.action.input)
  if (!storedInput) return confirmationUnavailableAnswer('missing')

  const executingReceipt = await markAiActionExecuting({
    actionRunId: lookup.action.id,
    aiRunId: lookup.action.aiRunId,
    companyId: input.user.companyId,
    actorId: input.user.id,
  })
  if (!executingReceipt) return confirmationUnavailableAnswer('used')

  try {
    const lookups = await loadLookups(input.user.companyId)
    const actionMessage = storedInput.canonicalMessage
    const kind = lookup.action.actionKind
    let result: AiActionResult

    if (kind === 'client') {
      result = await createClient({ message: actionMessage, user: input.user })
    } else if (kind === 'payment_alerts') {
      result = await sendPaymentDeadlineAlerts({ user: input.user })
    } else if (kind === 'mark_invoice_paid') {
      result = await markInvoicePaid({ message: actionMessage, user: input.user, lookups })
    } else if (kind.startsWith('delete_')) {
      const deleteKind = kind.replace('delete_', '') as DeletableKind
      result = await deleteWorkspaceRecord({ message: actionMessage, user: input.user, lookups, kind: deleteKind })
    } else if (kind === 'campaign') {
      result = await createCampaign({ message: actionMessage, user: input.user, lookups })
    } else if (kind === 'brief') {
      result = await createBrief({ message: actionMessage, user: input.user, lookups })
    } else if (kind === 'invoice') {
      result = await createInvoice({ message: actionMessage, user: input.user, lookups })
    } else {
      result = {
        handled: true,
        intent: 'action_error',
        confidence: 'low',
        answer: 'The confirmed AI action no longer maps to an executable tool.',
        citations: [],
        quickActions: ['Detect operational risks', 'Analyze delayed projects'],
        facts: { missingExecutor: kind },
      }
    }

    const completedReceipt = await markAiActionCompleted({
      actionRunId: lookup.action.id,
      aiRunId: lookup.action.aiRunId,
      companyId: input.user.companyId,
      actorId: input.user.id,
      result: result.facts ?? { intent: result.intent },
      receipt: executingReceipt,
    })

    return {
      ...result,
      answer: [
        result.answer ?? 'Done.',
        '',
        '**Execution Receipt**',
        `- Receipt: ${String(completedReceipt.receiptId)}`,
        `- AI action run: ${lookup.action.id}`,
        '- Confirmation, tenant scope, actor, and result were written to the audit trail.',
      ].join('\n'),
      facts: {
        ...(result.facts ?? {}),
        executionReceipt: completedReceipt,
        actionRunId: lookup.action.id,
        aiRunId: lookup.action.aiRunId,
      },
      executionReceipt: completedReceipt,
    }
  } catch (error) {
    const failedReceipt = await markAiActionFailed({
      actionRunId: lookup.action.id,
      aiRunId: lookup.action.aiRunId,
      companyId: input.user.companyId,
      actorId: input.user.id,
      error,
      receipt: executingReceipt,
    })

    return {
      handled: true,
      intent: 'action_error',
      confidence: 'low',
      answer: [
        '**Execution Failed**',
        'The confirmed AI action did not complete.',
        '',
        '**Governance**',
        `- Receipt: ${String(failedReceipt.receiptId)}`,
        '- The failure was recorded in the AI action audit trail.',
        '- No retry was attempted automatically.',
      ].join('\n'),
      citations: [],
      quickActions: ['Detect operational risks', 'Analyze delayed projects'],
      facts: {
        error: error instanceof Error ? error.message : 'Unknown action error',
        executionReceipt: failedReceipt,
        actionRunId: lookup.action.id,
        aiRunId: lookup.action.aiRunId,
      },
      executionReceipt: failedReceipt,
    }
  }
}

export async function executeAiWorkspaceAction(input: {
  message: string
  user: AiSessionUser
  confirmationToken?: string | null
  conversationId?: string | null
}): Promise<AiActionResult> {
  if (input.confirmationToken) {
    return executeConfirmedAiWorkspaceAction({
      confirmationToken: input.confirmationToken,
      user: input.user,
    })
  }

  const initialIntent = resolveIntent(input.message)
  const fallbackKind = getActionKind(input.message)
  if (!fallbackKind && !isPotentialActionIntent(initialIntent)) return { handled: false, resolvedIntent: initialIntent }

  try {
    const initialKind = actionKindFromResolvedIntent(initialIntent) ?? fallbackKind
    if (initialKind === 'delete') {
      return {
        ...missingTargetAnswer('delete', 'record type', ['invoice', 'client', 'campaign/project', 'brief', 'deliverable', 'task']),
        resolvedIntent: initialIntent,
      }
    }
    if (!input.user.companyId) {
      return {
        ...missingDetailsAnswer(initialKind ?? 'action', ['an active workspace']),
        resolvedIntent: initialIntent,
      }
    }

    const lookups = await loadLookups(input.user.companyId)
    const resolvedIntent = resolveIntent(input.message, { records: recordsFromLookups(lookups) })
    if (resolvedIntent.ambiguityPanel) return ambiguityActionAnswer(resolvedIntent)

    const kind = actionKindFromResolvedIntent(resolvedIntent) ?? fallbackKind
    const actionMessage = canonicalPromptForAction(resolvedIntent, input.message)

    if (!kind) return { handled: false, resolvedIntent }
    if (kind === 'delete') {
      return {
        ...missingTargetAnswer('delete', 'record type', ['invoice', 'client', 'campaign/project', 'brief', 'deliverable', 'task']),
        resolvedIntent,
      }
    }

    const result = await previewAiWorkspaceAction({
      kind,
      rawMessage: input.message,
      actionMessage,
      user: input.user,
      lookups,
      conversationId: input.conversationId,
    })
    return { ...result, resolvedIntent }
  } catch (error) {
    console.warn('[ai-actions] Action execution failed:', error)
    return {
      handled: true,
      intent: 'action_error',
      confidence: 'low',
      answer: 'I could not complete that workspace action because the action resolver hit an internal error.',
      citations: [],
      quickActions: ['Detect operational risks', 'Analyze delayed projects'],
      facts: { error: error instanceof Error ? error.message : 'Unknown action error' },
      resolvedIntent: initialIntent,
    }
  }
}
