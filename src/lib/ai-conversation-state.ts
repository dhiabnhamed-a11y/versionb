import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { executeAiWorkspaceAction } from '@/lib/ai-actions'
import type { AiCitation, AiGroundedAnswer, AiSessionUser } from '@/lib/ai-operations'
import { toJsonValue } from '@/modules/shared/json'

type WorkflowStatus = 'awaiting_input' | 'awaiting_confirmation' | 'executing' | 'completed' | 'failed' | 'expired' | 'cancelled'
type EntityKind = 'invoice' | 'client' | 'campaign' | 'brief' | 'deliverable' | 'task' | 'category' | 'room'

type PendingActionRecord = Awaited<ReturnType<typeof findActivePendingAction>>
type ActionExecutionResult = Awaited<ReturnType<typeof executeAiWorkspaceAction>>

const RESUMABLE_STATUSES: WorkflowStatus[] = ['awaiting_input', 'awaiting_confirmation', 'failed']
const DEFAULT_TTL_MINUTES = 60

const ENTITY_LABELS: Record<EntityKind, { singular: string; examples: string[] }> = {
  invoice: { singular: 'invoice', examples: ['invoice number', 'invoice ID', 'client name'] },
  client: { singular: 'client', examples: ['client name', 'client ID'] },
  campaign: { singular: 'campaign/project', examples: ['campaign name', 'project ID'] },
  brief: { singular: 'brief', examples: ['brief title', 'brief ID'] },
  deliverable: { singular: 'deliverable', examples: ['deliverable title', 'deliverable ID'] },
  task: { singular: 'task', examples: ['task title', 'task ID'] },
  category: { singular: 'category', examples: ['category name', 'category ID'] },
  room: { singular: 'room', examples: ['room name', 'room ID'] },
}

const DELETE_WORDS = ['delete', 'remove', 'erase', 'supprimer', 'effacer', 'retirer', 'حذف', 'احذف', 'مسح', 'امسح']
const MARK_WORDS = ['mark', 'set', 'update', 'change', 'paid', 'payment received', 'payed', 'payee', 'payé', 'réglée', 'مدفوع', 'مدفوعة']
const CONFIRM_WORDS = ['confirm', 'confirmed', 'yes confirm', 'approve', 'go ahead', 'execute', 'CONFIRM']
const CANCEL_WORDS = ['cancel', 'stop', 'nevermind', 'never mind', 'abort', 'annuler', 'إلغاء']

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date)
  next.setMinutes(next.getMinutes() + minutes)
  return next
}

function cleanText(value: string, limit = 4000) {
  return value.replace(/\s+/g, ' ').trim().slice(0, limit)
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(value: string, words: string[]) {
  const normalized = normalize(value)
  return words.some((word) => normalized.includes(normalize(word)))
}

function jsonArray(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function jsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function typedObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function workflowExpiresAt() {
  return addMinutes(new Date(), DEFAULT_TTL_MINUTES)
}

function isConfirmationMessage(message: string) {
  const normalized = normalize(message)
  return normalized === 'confirm' || normalized === 'yes' || CONFIRM_WORDS.some((word) => normalized.includes(normalize(word)))
}

function isCancelMessage(message: string) {
  const normalized = normalize(message)
  return CANCEL_WORDS.some((word) => normalized.includes(normalize(word)))
}

function detectEntityKind(message: string): EntityKind | null {
  const lower = normalize(message)
  if (/\binv(?:oice)?\b/.test(lower) || /\bfacture\b/.test(lower) || lower.includes('فاتورة')) return 'invoice'
  if (/\b(client|customer|account)\b/.test(lower) || lower.includes('عميل')) return 'client'
  if (/\b(project|campaign|campagne|projet)\b/.test(lower) || lower.includes('مشروع') || lower.includes('حملة')) return 'campaign'
  if (/\bbrief\b/.test(lower) || lower.includes('بريف')) return 'brief'
  if (/\bdeliverable|livrable\b/.test(lower)) return 'deliverable'
  if (/\btask|todo|mission|tache|tâche\b/.test(lower) || lower.includes('مهمة')) return 'task'
  if (/\bcategory|categorie|catégorie\b/.test(lower)) return 'category'
  if (/\broom|workspace room|salle\b/.test(lower)) return 'room'
  return null
}

function actionTypeForDelete(kind: EntityKind | null) {
  return kind ? `delete_${kind}` : 'delete'
}

function kindFromActionType(actionType: string): EntityKind | null {
  if (actionType === 'mark_invoice_paid' || actionType === 'send_invoice') return 'invoice'
  if (!actionType.startsWith('delete_')) return null
  const kind = actionType.replace('delete_', '') as EntityKind
  return Object.prototype.hasOwnProperty.call(ENTITY_LABELS, kind) ? kind : null
}

function detectInitialAction(message: string) {
  const lower = normalize(message)
  if (!lower) return null

  if (includesAny(lower, DELETE_WORDS)) {
    const kind = detectEntityKind(lower)
    return {
      actionType: actionTypeForDelete(kind),
      entityKind: kind,
      confirmationRequired: true,
      pendingFields: kind ? ['target'] : ['recordType', 'target'],
      currentStep: kind ? 'collect_target' : 'collect_record_type',
    }
  }

  if (lower.includes('invoice') && lower.includes('send')) {
    return {
      actionType: 'send_invoice',
      entityKind: 'invoice' as EntityKind,
      confirmationRequired: true,
      pendingFields: ['target'],
      currentStep: 'collect_target',
      unsupported: true,
    }
  }

  if (lower.includes('archive')) {
    const kind = detectEntityKind(lower)
    return {
      actionType: kind ? `archive_${kind}` : 'archive',
      entityKind: kind,
      confirmationRequired: true,
      pendingFields: kind ? ['target'] : ['recordType', 'target'],
      currentStep: kind ? 'collect_target' : 'collect_record_type',
      unsupported: true,
    }
  }

  if (lower.includes('payroll') && (lower.includes('run') || lower.includes('execute') || lower.includes('process'))) {
    return {
      actionType: 'execute_payroll',
      entityKind: null,
      confirmationRequired: true,
      pendingFields: ['payrollRun'],
      currentStep: 'collect_payroll_run',
      unsupported: true,
    }
  }

  if (lower.includes('invoice') && includesAny(lower, MARK_WORDS) && lower.includes('paid')) {
    return {
      actionType: 'mark_invoice_paid',
      entityKind: 'invoice' as EntityKind,
      confirmationRequired: true,
      pendingFields: ['target'],
      currentStep: 'collect_target',
    }
  }

  return null
}

function extractIdentifiers(message: string) {
  const uuid = message.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)?.[0] ?? null
  const cuid = message.match(/\b(c[a-z0-9]{8,}|[a-z0-9_-]{12,})\b/i)?.[0] ?? null
  const numeric = message.match(/\b\d{2,}\b/)?.[0] ?? null
  return { uuid, cuid, numeric, any: uuid ?? cuid ?? numeric }
}

function words(value: string) {
  return normalize(value)
    .split(/[^a-z0-9\u0600-\u06ff]+/i)
    .filter((token) => token.length > 1)
}

function scoreCandidate(message: string, candidate: EntityCandidate) {
  const normalizedMessage = normalize(message)
  const identifiers = extractIdentifiers(message)
  const allLabels = [candidate.id, candidate.label, ...(candidate.aliases ?? [])].filter(Boolean)

  if (identifiers.uuid && candidate.id.toLowerCase() === identifiers.uuid.toLowerCase()) return 120
  if (identifiers.cuid && candidate.id.toLowerCase() === identifiers.cuid.toLowerCase()) return 115
  if (identifiers.any && candidate.id.toLowerCase().endsWith(identifiers.any.toLowerCase())) return 104
  if (identifiers.numeric && candidate.label.toLowerCase().includes(identifiers.numeric.toLowerCase())) return 98

  let best = 0
  for (const label of allLabels) {
    const normalizedLabel = normalize(label)
    if (!normalizedLabel) continue
    if (normalizedMessage === normalizedLabel) best = Math.max(best, 95)
    if (normalizedMessage.includes(normalizedLabel)) best = Math.max(best, 80 + Math.min(normalizedLabel.length, 20))
    const labelWords = words(normalizedLabel).filter((word) => word.length > 2)
    const overlap = labelWords.reduce((sum, word) => sum + (normalizedMessage.includes(word) ? word.length : 0), 0)
    best = Math.max(best, overlap)
  }

  return best
}

type EntityCandidate = {
  id: string
  entity: EntityKind
  label: string
  href?: string
  aliases?: string[]
  details?: string
}

type ResolutionResult =
  | { status: 'resolved'; field: string; candidate: EntityCandidate; confidence: number }
  | { status: 'missing'; field: string; prompt: string; examples: EntityCandidate[] }
  | { status: 'ambiguous'; field: string; prompt: string; candidates: EntityCandidate[] }

async function loadEntityCandidates(companyId: string, kind: EntityKind): Promise<EntityCandidate[]> {
  if (kind === 'invoice') {
    const invoices = await prisma.invoice.findMany({
      where: { companyId },
      select: { id: true, invoiceNumber: true, clientName: true, status: true, total: true, currency: true },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 150,
    })
    return invoices.map((invoice) => ({
      id: invoice.id,
      entity: 'invoice',
      label: `${invoice.invoiceNumber} - ${invoice.clientName}`,
      aliases: [invoice.invoiceNumber, invoice.clientName, invoice.status],
      details: `${invoice.status} / ${invoice.currency} ${Number(invoice.total).toLocaleString('en-US')}`,
      href: '/dashboard/admin/invoices',
    }))
  }

  if (kind === 'client') {
    const clients = await prisma.client.findMany({
      where: { companyId },
      select: { id: true, companyName: true, email: true, contactPerson: true },
      orderBy: { updatedAt: 'desc' },
      take: 120,
    })
    return clients.map((client) => ({
      id: client.id,
      entity: 'client',
      label: client.companyName,
      aliases: [client.email ?? '', client.contactPerson ?? ''],
      details: client.email ?? 'Client',
      href: `/dashboard/admin/clients/${client.id}`,
    }))
  }

  if (kind === 'campaign') {
    const projects = await prisma.project.findMany({
      where: { companyId },
      select: { id: true, title: true, clientName: true },
      orderBy: { updatedAt: 'desc' },
      take: 150,
    })
    return projects.map((project) => ({
      id: project.id,
      entity: 'campaign',
      label: project.title,
      aliases: [project.clientName ?? ''],
      details: project.clientName ?? 'Campaign',
      href: `/dashboard/admin/projects/${project.id}`,
    }))
  }

  if (kind === 'brief') {
    const briefs = await prisma.brief.findMany({
      where: { companyId },
      select: { id: true, title: true, campaign: { select: { title: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 150,
    })
    return briefs.map((brief) => ({
      id: brief.id,
      entity: 'brief',
      label: brief.title,
      aliases: [brief.campaign.title],
      details: `Campaign: ${brief.campaign.title}`,
    }))
  }

  if (kind === 'deliverable') {
    const deliverables = await prisma.deliverable.findMany({
      where: { companyId },
      select: { id: true, title: true, campaign: { select: { title: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 150,
    })
    return deliverables.map((deliverable) => ({
      id: deliverable.id,
      entity: 'deliverable',
      label: deliverable.title,
      aliases: [deliverable.campaign.title],
      details: `Campaign: ${deliverable.campaign.title}`,
    }))
  }

  if (kind === 'task') {
    const tasks = await prisma.task.findMany({
      where: { project: { companyId } },
      select: { id: true, title: true, project: { select: { title: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 150,
    })
    return tasks.map((task) => ({
      id: task.id,
      entity: 'task',
      label: task.title,
      aliases: [task.project.title],
      details: `Campaign: ${task.project.title}`,
    }))
  }

  if (kind === 'category') {
    const categories = await prisma.projectCategory.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })
    return categories.map((category) => ({ id: category.id, entity: 'category', label: category.name }))
  }

  const rooms = await prisma.room.findMany({
    where: { companyId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 100,
  })
  return rooms.map((room) => ({ id: room.id, entity: 'room', label: room.name }))
}

function targetQuestion(kind: EntityKind, examples: EntityCandidate[] = []) {
  const label = ENTITY_LABELS[kind]
  const sample = examples.slice(0, 5).map((item) => `- ${item.label}${item.details ? ` (${item.details})` : ''}`)
  return [
    '**Awaiting Input**',
    `Which ${label.singular} should I use?`,
    '',
    '**Send One Of**',
    ...label.examples.map((example) => `- ${example}`),
    sample.length ? '' : '',
    sample.length ? '**Recent Matches**' : '',
    ...sample,
  ].filter(Boolean).join('\n')
}

function ambiguityQuestion(kind: EntityKind, candidates: EntityCandidate[]) {
  return [
    '**Ambiguous Match**',
    `I found multiple ${ENTITY_LABELS[kind].singular} records that could match.`,
    '',
    '**Choose One**',
    ...candidates.slice(0, 5).map((item) => `- ${item.label}${item.details ? ` (${item.details})` : ''}`),
    '',
    '**Next Step**',
    `Reply with the exact ${ENTITY_LABELS[kind].singular} name or ID.`,
  ].join('\n')
}

export async function ensureAiConversationForState(input: {
  user: AiSessionUser
  conversationId?: string | null
  question: string
}) {
  if (!input.user.companyId) return input.conversationId ?? null

  if (input.conversationId) {
    const existing = await prisma.aiConversation.findFirst({
      where: {
        id: input.conversationId,
        companyId: input.user.companyId,
        userId: input.user.id,
      },
      select: { id: true },
    })
    if (existing) return existing.id
  }

  const conversation = await prisma.aiConversation.create({
    data: {
      companyId: input.user.companyId,
      userId: input.user.id,
      title: cleanText(input.question, 90) || 'AI workflow',
      context: Prisma.JsonNull,
    },
    select: { id: true },
  })

  return conversation.id
}

async function appendWorkflowStep(input: {
  stateId: string
  pendingActionId?: string | null
  companyId: string
  userId: string
  conversationId: string
  status: WorkflowStatus
  actionType: string
  pendingFields?: string[]
  resolvedFields?: Record<string, unknown>
  currentStep: string
  label?: string
  eventType?: string
  message?: string
  confirmationRequired?: boolean
  metadata?: Record<string, unknown>
  expiresAt?: Date | null
}) {
  const count = await prisma.aiWorkflowStep.count({ where: { pendingActionId: input.pendingActionId ?? undefined } })
  return prisma.aiWorkflowStep.create({
    data: {
      stateId: input.stateId,
      pendingActionId: input.pendingActionId ?? null,
      companyId: input.companyId,
      userId: input.userId,
      conversationId: input.conversationId,
      status: input.status,
      actionType: input.actionType,
      pendingFields: toJsonValue(input.pendingFields ?? []),
      resolvedFields: toJsonValue(input.resolvedFields ?? {}),
      currentStep: input.currentStep,
      stepIndex: count,
      label: input.label ?? null,
      eventType: input.eventType ?? 'state_transition',
      message: input.message ?? null,
      confirmationRequired: input.confirmationRequired ?? false,
      metadata: toJsonValue(input.metadata ?? {}),
      expiresAt: input.expiresAt ?? null,
    },
  })
}

async function findActivePendingAction(input: {
  companyId: string
  userId: string
  conversationId?: string | null
}) {
  const now = new Date()
  return prisma.aiPendingAction.findFirst({
    where: {
      companyId: input.companyId,
      userId: input.userId,
      status: { in: RESUMABLE_STATUSES },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      state: true,
      workflowSteps: { orderBy: { createdAt: 'asc' }, take: 20 },
      actionContexts: { orderBy: { createdAt: 'desc' }, take: 8 },
    },
  })
}

async function expireOverdueActions(companyId: string, userId: string) {
  const now = new Date()
  const overdue = await prisma.aiPendingAction.findMany({
    where: {
      companyId,
      userId,
      status: { in: ['awaiting_input', 'awaiting_confirmation'] },
      expiresAt: { lte: now },
    },
    select: { id: true, stateId: true },
    take: 20,
  })
  if (!overdue.length) return

  await prisma.$transaction([
    prisma.aiPendingAction.updateMany({
      where: { id: { in: overdue.map((item) => item.id) } },
      data: { status: 'expired', error: 'Pending AI action expired before the user replied.' },
    }),
    prisma.aiConversationState.updateMany({
      where: { id: { in: overdue.map((item) => item.stateId) } },
      data: { status: 'expired', currentStep: 'expired' },
    }),
  ])
}

export async function resolvePendingActionInput(input: {
  companyId: string
  actionType: string
  message: string
  pendingFields: string[]
  resolvedFields?: Record<string, unknown>
}): Promise<{ resolvedFields: Record<string, unknown>; pendingFields: string[]; resolution?: ResolutionResult }> {
  const resolvedFields = { ...(input.resolvedFields ?? {}) }
  let pendingFields = [...input.pendingFields]

  if (pendingFields.includes('recordType')) {
    const kind = detectEntityKind(input.message)
    if (!kind) {
      return {
        resolvedFields,
        pendingFields,
        resolution: {
          status: 'missing',
          field: 'recordType',
          prompt: [
            '**Awaiting Input**',
            'What type of record should I work with?',
            '',
            '**Supported Record Types**',
            '- invoice',
            '- client',
            '- campaign/project',
            '- brief',
            '- deliverable',
            '- task',
          ].join('\n'),
          examples: [],
        },
      }
    }

    resolvedFields.recordType = kind
    resolvedFields.actionType = input.actionType === 'delete' ? actionTypeForDelete(kind) : input.actionType
    pendingFields = pendingFields.filter((field) => field !== 'recordType')
  }

  if (pendingFields.includes('target')) {
    const kind = (typeof resolvedFields.recordType === 'string' ? resolvedFields.recordType : kindFromActionType(input.actionType)) as EntityKind | null
    if (!kind) return { resolvedFields, pendingFields }

    const candidates = await loadEntityCandidates(input.companyId, kind)
    const scored = candidates
      .map((candidate) => ({ candidate, score: scoreCandidate(input.message, candidate) }))
      .filter((item) => item.score >= 4)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) {
      return {
        resolvedFields,
        pendingFields,
        resolution: { status: 'missing', field: 'target', prompt: targetQuestion(kind, candidates), examples: candidates.slice(0, 5) },
      }
    }

    const top = scored[0]
    const tied = scored.filter((item) => Math.abs(item.score - top.score) <= 2)
    if (tied.length > 1 && top.score < 95) {
      return {
        resolvedFields,
        pendingFields,
        resolution: { status: 'ambiguous', field: 'target', prompt: ambiguityQuestion(kind, tied.map((item) => item.candidate)), candidates: tied.map((item) => item.candidate) },
      }
    }

    resolvedFields.target = {
      entityType: top.candidate.entity,
      entityId: top.candidate.id,
      label: top.candidate.label,
      href: top.candidate.href ?? null,
    }
    resolvedFields.targetInput = cleanText(input.message, 500)
    resolvedFields.recordType = kind
    pendingFields = pendingFields.filter((field) => field !== 'target')

    return {
      resolvedFields,
      pendingFields,
      resolution: { status: 'resolved', field: 'target', candidate: top.candidate, confidence: Math.min(0.99, top.score / 100) },
    }
  }

  return { resolvedFields, pendingFields }
}

function canonicalMessageForAction(actionType: string, resolvedFields: Record<string, unknown>) {
  const target = typedObject(resolvedFields.target)
  const targetId = typeof target.entityId === 'string' ? target.entityId : ''
  const targetType = typeof target.entityType === 'string' ? target.entityType : kindFromActionType(actionType)

  if (actionType === 'mark_invoice_paid') return `Mark invoice paid invoice id: ${targetId}`
  if (actionType.startsWith('delete_')) return `Delete ${targetType === 'campaign' ? 'project' : targetType} id: ${targetId}`
  return ''
}

function citationsForResolvedTarget(resolvedFields: Record<string, unknown>): AiCitation[] {
  const target = typedObject(resolvedFields.target)
  const id = typeof target.entityId === 'string' ? target.entityId : ''
  const type = typeof target.entityType === 'string' ? target.entityType : ''
  const label = typeof target.label === 'string' ? target.label : id
  const href = typeof target.href === 'string' ? target.href : undefined
  if (!id || !['invoice', 'client', 'campaign', 'brief', 'deliverable', 'task'].includes(type)) return []
  return [{ id, type: type === 'campaign' ? 'project' : (type as AiCitation['type']), label, href }]
}

function groundedFromResult(result: ActionExecutionResult, actionType: string): AiGroundedAnswer {
  return {
    answer: result.answer ?? 'Done.',
    intent: result.intent ?? actionType,
    confidence: result.confidence ?? 'medium',
    citations: result.citations ?? [],
    quickActions: result.quickActions ?? ['Detect operational risks', 'Analyze delayed projects'],
    facts: {
      ...(result.facts ?? {}),
      ...(result.actionPreview ? { actionPreview: result.actionPreview } : {}),
      ...(result.executionReceipt ? { executionReceipt: result.executionReceipt } : {}),
      generatedAt: new Date().toISOString(),
    },
    language: result.resolvedIntent?.language,
    dir: result.resolvedIntent?.language === 'ar' ? 'rtl' : 'ltr',
    resolvedIntent: result.resolvedIntent,
    ambiguity: result.ambiguity,
    policy: { role: 'EMPLOYEE', scope: 'workspace', financeVisible: true },
  }
}

function stateGrounded(input: {
  answer: string
  intent: string
  facts?: Record<string, unknown>
  citations?: AiCitation[]
  quickActions?: string[]
  user: AiSessionUser
}): AiGroundedAnswer {
  const role = input.user.role?.trim().toUpperCase() || 'EMPLOYEE'
  return {
    answer: input.answer,
    intent: input.intent,
    confidence: 'high',
    citations: input.citations ?? [],
    quickActions: input.quickActions ?? ['Analyze delayed projects', 'Find overdue invoices'],
    facts: { ...(input.facts ?? {}), generatedAt: new Date().toISOString() },
    policy: {
      role,
      scope: role === 'EMPLOYEE' ? 'assigned-work' : 'workspace',
      financeVisible: role === 'OWNER' || role === 'MANAGER',
    },
  }
}

function workflowSnapshotFromPending(pending: NonNullable<PendingActionRecord>) {
  return {
    stateId: pending.stateId,
    pendingActionId: pending.id,
    conversationId: pending.conversationId,
    status: pending.status,
    actionType: pending.actionType,
    pendingFields: jsonArray(pending.pendingFields),
    resolvedFields: jsonObject(pending.resolvedFields),
    currentStep: pending.currentStep,
    expiresAt: pending.expiresAt?.toISOString() ?? null,
    confirmationRequired: pending.confirmationRequired,
    targetType: pending.targetType,
    targetId: pending.targetId,
    targetLabel: pending.targetLabel,
    receipt: pending.receipt,
    error: pending.error,
    timeline: pending.workflowSteps.map((step) => ({
      id: step.id,
      status: step.status,
      currentStep: step.currentStep,
      label: step.label,
      eventType: step.eventType,
      message: step.message,
      createdAt: step.createdAt.toISOString(),
      metadata: step.metadata,
    })),
  }
}

async function createPendingAction(input: {
  user: AiSessionUser
  conversationId: string
  actionType: string
  pendingFields: string[]
  resolvedFields?: Record<string, unknown>
  currentStep: string
  confirmationRequired: boolean
  prompt: string
}) {
  if (!input.user.companyId) return null
  const expiresAt = workflowExpiresAt()
  const state = await prisma.aiConversationState.create({
    data: {
      companyId: input.user.companyId,
      userId: input.user.id,
      conversationId: input.conversationId,
      status: 'awaiting_input',
      actionType: input.actionType,
      pendingFields: toJsonValue(input.pendingFields),
      resolvedFields: toJsonValue(input.resolvedFields ?? {}),
      currentStep: input.currentStep,
      expiresAt,
      confirmationRequired: input.confirmationRequired,
      metadata: toJsonValue({ engine: 'ai_conversation_state_engine', createdFrom: 'chat' }),
    },
  })

  const pending = await prisma.aiPendingAction.create({
    data: {
      stateId: state.id,
      companyId: input.user.companyId,
      userId: input.user.id,
      conversationId: input.conversationId,
      status: 'awaiting_input',
      actionType: input.actionType,
      pendingFields: toJsonValue(input.pendingFields),
      resolvedFields: toJsonValue(input.resolvedFields ?? {}),
      currentStep: input.currentStep,
      expiresAt,
      confirmationRequired: input.confirmationRequired,
      lastPrompt: input.prompt,
    },
  })

  await appendWorkflowStep({
    stateId: state.id,
    pendingActionId: pending.id,
    companyId: input.user.companyId,
    userId: input.user.id,
    conversationId: input.conversationId,
    status: 'awaiting_input',
    actionType: input.actionType,
    pendingFields: input.pendingFields,
    resolvedFields: input.resolvedFields ?? {},
    currentStep: input.currentStep,
    label: 'Awaiting missing parameters',
    message: input.prompt,
    confirmationRequired: input.confirmationRequired,
    expiresAt,
  })

  return prisma.aiPendingAction.findUnique({
    where: { id: pending.id },
    include: {
      state: true,
      workflowSteps: { orderBy: { createdAt: 'asc' }, take: 20 },
      actionContexts: { orderBy: { createdAt: 'desc' }, take: 8 },
    },
  })
}

async function updatePendingFromResolution(input: {
  pending: NonNullable<PendingActionRecord>
  status: WorkflowStatus
  pendingFields: string[]
  resolvedFields: Record<string, unknown>
  currentStep: string
  message: string
  receipt?: Record<string, unknown> | null
  error?: string | null
  actionPreview?: ActionExecutionResult['actionPreview'] | null
}) {
  const target = typedObject(input.resolvedFields.target)
  const targetId = typeof target.entityId === 'string' ? target.entityId : null
  const targetType = typeof target.entityType === 'string' ? target.entityType : null
  const targetLabel = typeof target.label === 'string' ? target.label : null
  const actionPreview = input.actionPreview
  const previewFields = actionPreview
    ? {
        aiRunId: actionPreview.aiRunId,
        aiActionRunId: actionPreview.actionRunId,
        confirmationToken: actionPreview.confirmationToken,
        confirmationExpiresAt: actionPreview.confirmationExpiresAt,
      }
    : {}
  const resolvedFields = { ...input.resolvedFields, ...previewFields }
  const expiresAt = actionPreview?.confirmationExpiresAt ? new Date(actionPreview.confirmationExpiresAt) : input.pending.expiresAt

  await prisma.$transaction([
    prisma.aiPendingAction.update({
      where: { id: input.pending.id },
      data: {
        status: input.status,
        pendingFields: toJsonValue(input.pendingFields),
        resolvedFields: toJsonValue(resolvedFields),
        currentStep: input.currentStep,
        targetId,
        targetType,
        targetLabel,
        receipt: input.receipt ? toJsonValue(input.receipt) : undefined,
        error: input.error ?? undefined,
        attemptCount: { increment: 1 },
        expiresAt,
      },
    }),
    prisma.aiConversationState.update({
      where: { id: input.pending.stateId },
      data: {
        status: input.status,
        pendingFields: toJsonValue(input.pendingFields),
        resolvedFields: toJsonValue(resolvedFields),
        currentStep: input.currentStep,
        expiresAt,
        confirmationRequired: input.status === 'awaiting_confirmation',
      },
    }),
  ])

  await appendWorkflowStep({
    stateId: input.pending.stateId,
    pendingActionId: input.pending.id,
    companyId: input.pending.companyId,
    userId: input.pending.userId,
    conversationId: input.pending.conversationId,
    status: input.status,
    actionType: input.pending.actionType,
    pendingFields: input.pendingFields,
    resolvedFields,
    currentStep: input.currentStep,
    label: input.status === 'awaiting_confirmation' ? 'Preview generated' : input.status === 'completed' ? 'Action completed' : input.status === 'failed' ? 'Action failed' : 'Input resolved',
    message: input.message,
    confirmationRequired: input.status === 'awaiting_confirmation',
    metadata: input.receipt ? { receipt: input.receipt } : actionPreview ? { actionPreview } : {},
    expiresAt,
  })

  return findActivePendingAction({
    companyId: input.pending.companyId,
    userId: input.pending.userId,
    conversationId: input.pending.conversationId,
  })
}

async function continueResolvedAction(input: {
  pending: NonNullable<PendingActionRecord>
  user: AiSessionUser
  message: string
  pendingFields: string[]
  resolvedFields: Record<string, unknown>
}) {
  if (input.pendingFields.length > 0) return null

  if (input.pending.actionType.startsWith('archive_') || input.pending.actionType === 'archive' || input.pending.actionType === 'send_invoice' || input.pending.actionType === 'execute_payroll') {
    const failed = await updatePendingFromResolution({
      pending: input.pending,
      status: 'failed',
      pendingFields: [],
      resolvedFields: input.resolvedFields,
      currentStep: 'unsupported_tool',
      message: 'No registered execution tool exists for this dangerous action yet.',
      error: 'Unsupported AI operational tool.',
    })
    return {
      grounded: stateGrounded({
        user: input.user,
        intent: input.pending.actionType,
        answer: [
          '**Action Not Executed**',
          'I kept the context, but this dangerous operation does not have a registered backend tool yet.',
          '',
          '**Governance**',
          '- No workspace data was changed.',
          '- A failed workflow record was saved for audit and retry planning.',
        ].join('\n'),
        facts: { conversationState: failed ? workflowSnapshotFromPending(failed) : null },
      }),
      state: failed ? workflowSnapshotFromPending(failed) : null,
    }
  }

  const canonicalMessage = canonicalMessageForAction(input.pending.actionType, input.resolvedFields)
  if (!canonicalMessage) return null

  const result = await executeAiWorkspaceAction({
    message: canonicalMessage,
    user: input.user,
    conversationId: input.pending.conversationId,
  })

  const nextStatus: WorkflowStatus = result.actionPreview ? 'awaiting_confirmation' : result.executionReceipt ? 'completed' : result.handled ? 'completed' : 'failed'
  const next = await updatePendingFromResolution({
    pending: input.pending,
    status: nextStatus,
    pendingFields: input.pendingFields,
    resolvedFields: input.resolvedFields,
    currentStep: result.actionPreview ? 'awaiting_confirmation' : result.executionReceipt ? 'completed' : 'preview_completed',
    message: result.actionPreview ? 'Generated governed dry-run preview.' : 'Action execution finished.',
    actionPreview: result.actionPreview ?? null,
    receipt: result.executionReceipt ?? null,
    error: !result.handled ? 'The action was not handled by the registered tool runtime.' : null,
  })

  const grounded = groundedFromResult(result, input.pending.actionType)
  grounded.facts.conversationState = next ? workflowSnapshotFromPending(next) : null
  grounded.policy = stateGrounded({ user: input.user, intent: input.pending.actionType, answer: '' }).policy
  return { grounded, state: next ? workflowSnapshotFromPending(next) : null }
}

async function continuePendingAction(input: {
  pending: NonNullable<PendingActionRecord>
  user: AiSessionUser
  message: string
}) {
  if (isCancelMessage(input.message)) {
    await prisma.$transaction([
      prisma.aiPendingAction.update({
        where: { id: input.pending.id },
        data: { status: 'cancelled', currentStep: 'cancelled', error: null },
      }),
      prisma.aiConversationState.update({
        where: { id: input.pending.stateId },
        data: { status: 'cancelled', currentStep: 'cancelled' },
      }),
    ])
    await appendWorkflowStep({
      stateId: input.pending.stateId,
      pendingActionId: input.pending.id,
      companyId: input.pending.companyId,
      userId: input.pending.userId,
      conversationId: input.pending.conversationId,
      status: 'cancelled',
      actionType: input.pending.actionType,
      pendingFields: jsonArray(input.pending.pendingFields),
      resolvedFields: jsonObject(input.pending.resolvedFields),
      currentStep: 'cancelled',
      label: 'Action cancelled',
      message: 'User cancelled the pending AI workflow.',
    })
    return {
      grounded: stateGrounded({
        user: input.user,
        intent: input.pending.actionType,
        answer: '**Action Cancelled**\nNo workspace data was changed. I cleared the pending workflow for this conversation.',
        facts: { cancelled: true },
        quickActions: ['Analyze delayed projects', 'Find overdue invoices', 'Delete record'],
      }),
      state: null,
    }
  }

  if (input.pending.status === 'failed' && !normalize(input.message).startsWith('retry')) {
    return {
      grounded: stateGrounded({
        user: input.user,
        intent: input.pending.actionType,
        answer: [
          '**Failed Action Recovery**',
          'The previous workflow is failed and has been kept for audit recovery.',
          '',
          '**Next Step**',
          '- Send Retry to run the same resolved action again.',
          '- Send Cancel to clear this pending workflow.',
        ].join('\n'),
        facts: { conversationState: workflowSnapshotFromPending(input.pending) },
        quickActions: ['Retry', 'Cancel', 'Analyze delayed projects'],
      }),
      state: workflowSnapshotFromPending(input.pending),
    }
  }

  if (input.pending.status === 'awaiting_confirmation') {
    const resolvedFields = jsonObject(input.pending.resolvedFields)
    const confirmationToken = typeof resolvedFields.confirmationToken === 'string' ? resolvedFields.confirmationToken : null
    if (!isConfirmationMessage(input.message)) {
      return {
        grounded: stateGrounded({
          user: input.user,
          intent: input.pending.actionType,
          answer: [
            '**Awaiting Confirmation**',
            'The action is planned and previewed. Type CONFIRM to execute it, or Cancel to stop it.',
            '',
            '**Status**',
            `- Action: ${input.pending.actionType}`,
            input.pending.targetLabel ? `- Target: ${input.pending.targetLabel}` : '',
          ].filter(Boolean).join('\n'),
          facts: { conversationState: workflowSnapshotFromPending(input.pending) },
          quickActions: ['Cancel', 'Analyze delayed projects'],
        }),
        state: workflowSnapshotFromPending(input.pending),
      }
    }

    if (!confirmationToken) {
      await updatePendingFromResolution({
        pending: input.pending,
        status: 'failed',
        pendingFields: [],
        resolvedFields,
        currentStep: 'confirmation_token_missing',
        message: 'Confirmation token missing from resumable state.',
        error: 'Confirmation token missing.',
      })
      return {
        grounded: stateGrounded({
          user: input.user,
          intent: input.pending.actionType,
          answer: '**Confirmation Not Executed**\nThe preview token is missing or expired. Run the request again to generate a fresh governed preview.',
          facts: { confirmationFailed: true },
        }),
        state: null,
      }
    }

    await updatePendingFromResolution({
      pending: input.pending,
      status: 'executing',
      pendingFields: [],
      resolvedFields,
      currentStep: 'executing',
      message: 'User confirmed pending AI action.',
    })

    const result = await executeAiWorkspaceAction({
      message: 'Confirm AI action',
      user: input.user,
      confirmationToken,
      conversationId: input.pending.conversationId,
    })
    const receipt = result.executionReceipt ?? (typedObject(result.facts?.executionReceipt) as Record<string, unknown>)
    const status: WorkflowStatus = result.facts?.confirmationFailed || result.intent === 'action_error' ? 'failed' : 'completed'
    const next = await updatePendingFromResolution({
      pending: input.pending,
      status,
      pendingFields: [],
      resolvedFields,
      currentStep: status === 'completed' ? 'completed' : 'failed',
      message: status === 'completed' ? 'Confirmed action completed.' : 'Confirmed action failed.',
      receipt: Object.keys(receipt).length ? receipt : null,
      error: status === 'failed' ? String(result.facts?.error ?? 'Confirmed action failed.') : null,
    })
    const grounded = groundedFromResult(result, input.pending.actionType)
    grounded.facts.conversationState = next ? workflowSnapshotFromPending(next) : null
    grounded.policy = stateGrounded({ user: input.user, intent: input.pending.actionType, answer: '' }).policy
    return { grounded, state: next ? workflowSnapshotFromPending(next) : null }
  }

  const pendingFields = jsonArray(input.pending.pendingFields)
  const resolvedFields = jsonObject(input.pending.resolvedFields)
  const resolved = await resolvePendingActionInput({
    companyId: input.pending.companyId,
    actionType: input.pending.actionType,
    message: input.message,
    pendingFields,
    resolvedFields,
  })

  await prisma.aiActionContext.create({
    data: {
      stateId: input.pending.stateId,
      pendingActionId: input.pending.id,
      companyId: input.pending.companyId,
      userId: input.pending.userId,
      conversationId: input.pending.conversationId,
      status: resolved.pendingFields.length ? 'awaiting_input' : 'executing',
      actionType: String(resolved.resolvedFields.actionType ?? input.pending.actionType),
      pendingFields: toJsonValue(resolved.pendingFields),
      resolvedFields: toJsonValue(resolved.resolvedFields),
      currentStep: resolved.pendingFields.length ? 'collect_missing_fields' : 'parameters_resolved',
      expiresAt: input.pending.expiresAt,
      confirmationRequired: input.pending.confirmationRequired,
      contextType: 'parameter_resolution',
      context: toJsonValue({
        message: input.message,
        resolution: resolved.resolution ?? null,
      }) as Prisma.InputJsonValue,
      confidence: resolved.resolution?.status === 'resolved' ? resolved.resolution.confidence : 0.55,
    },
  })

  if (resolved.resolution?.status === 'missing' || resolved.resolution?.status === 'ambiguous') {
    const next = await updatePendingFromResolution({
      pending: input.pending,
      status: 'awaiting_input',
      pendingFields: resolved.pendingFields,
      resolvedFields: resolved.resolvedFields,
      currentStep: resolved.resolution.field === 'recordType' ? 'collect_record_type' : 'collect_target',
      message: resolved.resolution.prompt,
    })
    return {
      grounded: stateGrounded({
        user: input.user,
        intent: input.pending.actionType,
        answer: resolved.resolution.prompt,
        facts: { conversationState: next ? workflowSnapshotFromPending(next) : null },
        quickActions: ['Cancel', 'Analyze delayed projects'],
      }),
      state: next ? workflowSnapshotFromPending(next) : null,
    }
  }

  return continueResolvedAction({
    pending: input.pending,
    user: input.user,
    message: input.message,
    pendingFields: resolved.pendingFields,
    resolvedFields: resolved.resolvedFields,
  })
}

export async function handleAiConversationStateTurn(input: {
  user: AiSessionUser
  conversationId: string | null
  question: string
  confirmationToken?: string | null
}): Promise<{ handled: boolean; grounded?: AiGroundedAnswer; conversationId: string | null; state?: ReturnType<typeof workflowSnapshotFromPending> | null }> {
  if (!input.user.companyId || input.confirmationToken) {
    return { handled: false, conversationId: input.conversationId, state: null }
  }

  await expireOverdueActions(input.user.companyId, input.user.id)
  const conversationId = await ensureAiConversationForState({ user: input.user, conversationId: input.conversationId, question: input.question })
  if (!conversationId) return { handled: false, conversationId: input.conversationId, state: null }

  const pending = await findActivePendingAction({
    companyId: input.user.companyId,
    userId: input.user.id,
    conversationId,
  })
  if (pending) {
    const continued = await continuePendingAction({ pending, user: input.user, message: input.question })
    if (continued) return { handled: true, grounded: continued.grounded, conversationId, state: continued.state }
  }

  const initial = detectInitialAction(input.question)
  if (!initial) return { handled: false, conversationId, state: null }

  const resolved = await resolvePendingActionInput({
    companyId: input.user.companyId,
    actionType: initial.actionType,
    message: input.question,
    pendingFields: initial.pendingFields,
    resolvedFields: initial.entityKind ? { recordType: initial.entityKind } : {},
  })

  if (resolved.pendingFields.length === 0 && !initial.unsupported) {
    return { handled: false, conversationId, state: null }
  }

  const actionType = typeof resolved.resolvedFields.actionType === 'string' ? resolved.resolvedFields.actionType : initial.actionType
  const prompt =
    resolved.resolution?.status === 'missing' || resolved.resolution?.status === 'ambiguous'
      ? resolved.resolution.prompt
      : initial.entityKind
        ? targetQuestion(initial.entityKind)
        : 'What record type and target should I use?'
  const pendingAction = await createPendingAction({
    user: input.user,
    conversationId,
    actionType,
    pendingFields: resolved.pendingFields,
    resolvedFields: resolved.resolvedFields,
    currentStep: resolved.pendingFields.includes('recordType') ? 'collect_record_type' : 'collect_target',
    confirmationRequired: initial.confirmationRequired,
    prompt,
  })

  if (!pendingAction) return { handled: false, conversationId, state: null }

  const state = workflowSnapshotFromPending(pendingAction)
  return {
    handled: true,
    conversationId,
    state,
    grounded: stateGrounded({
      user: input.user,
      intent: actionType,
      answer: prompt,
      citations: citationsForResolvedTarget(resolved.resolvedFields),
      quickActions: ['Cancel', 'Analyze delayed projects', 'Find overdue invoices'],
      facts: {
        pendingAction: true,
        conversationState: state,
      },
    }),
  }
}

export async function syncConversationStateFromGrounded(input: {
  user: AiSessionUser
  conversationId?: string | null
  grounded: AiGroundedAnswer
}) {
  if (!input.user.companyId || !input.conversationId) return null
  const actionPreview = typedObject(input.grounded.facts.actionPreview)
  const executionReceipt = typedObject(input.grounded.facts.executionReceipt)
  const actionKind = typeof actionPreview.actionKind === 'string' ? actionPreview.actionKind : input.grounded.intent

  if (Object.keys(actionPreview).length) {
    const existing = await findActivePendingAction({
      companyId: input.user.companyId,
      userId: input.user.id,
      conversationId: input.conversationId,
    })
    if (existing?.status === 'awaiting_confirmation') return workflowSnapshotFromPending(existing)

    const resolvedFields = {
      confirmationToken: actionPreview.confirmationToken,
      confirmationExpiresAt: actionPreview.confirmationExpiresAt,
      target: {
        entityType: actionPreview.targetType ?? null,
        entityId: actionPreview.targetId ?? null,
        label: actionPreview.targetLabel ?? actionPreview.summary,
      },
    }
    const pending = await createPendingAction({
      user: input.user,
      conversationId: input.conversationId,
      actionType: actionKind,
      pendingFields: [],
      resolvedFields,
      currentStep: 'awaiting_confirmation',
      confirmationRequired: true,
      prompt: 'Governed preview generated; awaiting confirmation.',
    })
    if (!pending) return null

    const updated = await updatePendingFromResolution({
      pending,
      status: 'awaiting_confirmation',
      pendingFields: [],
      resolvedFields,
      currentStep: 'awaiting_confirmation',
      message: 'Governed preview generated; awaiting confirmation.',
      actionPreview: actionPreview as ActionExecutionResult['actionPreview'],
    })
    return updated ? workflowSnapshotFromPending(updated) : null
  }

  if (Object.keys(executionReceipt).length) {
    const pending = await findActivePendingAction({
      companyId: input.user.companyId,
      userId: input.user.id,
      conversationId: input.conversationId,
    })
    if (!pending) return null
    const updated = await updatePendingFromResolution({
      pending,
      status: input.grounded.intent === 'action_error' ? 'failed' : 'completed',
      pendingFields: [],
      resolvedFields: jsonObject(pending.resolvedFields),
      currentStep: input.grounded.intent === 'action_error' ? 'failed' : 'completed',
      message: input.grounded.intent === 'action_error' ? 'Execution failed.' : 'Execution completed.',
      receipt: executionReceipt,
      error: input.grounded.intent === 'action_error' ? String(input.grounded.facts.error ?? 'Execution failed.') : null,
    })
    return updated ? workflowSnapshotFromPending(updated) : null
  }

  return null
}

export async function getAiConversationReplay(input: {
  user: AiSessionUser
  conversationId?: string | null
}) {
  if (!input.user.companyId) {
    return { conversationId: null, messages: [], state: null, actionHistory: [], timeline: [], receipts: [] }
  }

  await expireOverdueActions(input.user.companyId, input.user.id)
  const pending = await findActivePendingAction({
    companyId: input.user.companyId,
    userId: input.user.id,
    conversationId: input.conversationId,
  })

  const conversation =
    input.conversationId
      ? await prisma.aiConversation.findFirst({
          where: { id: input.conversationId, companyId: input.user.companyId, userId: input.user.id },
          select: { id: true },
        })
      : pending
        ? { id: pending.conversationId }
        : await prisma.aiConversation.findFirst({
            where: { companyId: input.user.companyId, userId: input.user.id },
            orderBy: { updatedAt: 'desc' },
            select: { id: true },
          })

  const conversationId = conversation?.id ?? pending?.conversationId ?? null
  const [messages, actions, timeline] = conversationId
    ? await Promise.all([
        prisma.aiMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'asc' },
          take: 40,
        }),
        prisma.aiPendingAction.findMany({
          where: { companyId: input.user.companyId, userId: input.user.id, conversationId },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        }),
        prisma.aiWorkflowStep.findMany({
          where: { companyId: input.user.companyId, userId: input.user.id, conversationId },
          orderBy: { createdAt: 'asc' },
          take: 80,
        }),
      ])
    : [[], [], []]

  return {
    conversationId,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      intent: message.intent,
      citations: message.citations,
      createdAt: message.createdAt.toISOString(),
    })),
    state: pending ? workflowSnapshotFromPending(pending) : null,
    actionHistory: actions.map((action) => ({
      id: action.id,
      status: action.status,
      actionType: action.actionType,
      targetType: action.targetType,
      targetId: action.targetId,
      targetLabel: action.targetLabel,
      currentStep: action.currentStep,
      receipt: action.receipt,
      error: action.error,
      updatedAt: action.updatedAt.toISOString(),
    })),
    timeline: timeline.map((step) => ({
      id: step.id,
      pendingActionId: step.pendingActionId,
      status: step.status,
      actionType: step.actionType,
      currentStep: step.currentStep,
      label: step.label,
      eventType: step.eventType,
      message: step.message,
      createdAt: step.createdAt.toISOString(),
    })),
    receipts: actions.filter((action) => action.receipt).map((action) => action.receipt),
  }
}
