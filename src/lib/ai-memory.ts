import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { AiGroundedAnswer, AiMemoryContext, AiMemoryItem, AiMessageInput, AiSessionUser } from '@/lib/ai-operations'

type MemoryCandidate = {
  scope: 'workspace' | 'user'
  kind: string
  key: string
  value: string
  confidence: number
  source: string
}

const MEMORY_LIMIT = 12

function normalizeRole(role?: string | null) {
  return role?.trim().toUpperCase() || 'EMPLOYEE'
}

function canUseWorkspaceMemory(user: AiSessionUser) {
  const role = normalizeRole(user.role)
  return Boolean(user.companyId) && role !== 'SUPER_ADMIN'
}

function cleanText(value: string, limit = 700) {
  return value.replace(/\s+/g, ' ').trim().slice(0, limit)
}

function slugKey(value: string, limit = 72) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, limit)

  return slug || 'memory'
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
  )
}

function overlapScore(question: string, value: string) {
  const q = tokenize(question)
  if (!q.size) return 0
  let score = 0
  for (const token of tokenize(value)) {
    if (q.has(token)) score += 1
  }
  return score
}

export function extractExplicitMemoryStatement(question: string) {
  const patterns = [
    /\bremember(?: that)?\s+(.+)$/i,
    /\bnote(?: that)?\s+(.+)$/i,
    /\bsave(?: this| that)?(?: as memory)?:?\s+(.+)$/i,
    /\bour preference is\s+(.+)$/i,
    /\bwe prefer\s+(.+)$/i,
    /\bmy preference is\s+(.+)$/i,
    /\bi prefer\s+(.+)$/i,
  ]

  for (const pattern of patterns) {
    const match = question.match(pattern)
    const statement = cleanText(match?.[1] ?? '', 500)
    if (statement.length >= 8) return statement
  }

  return null
}

function scopeForExplicitMemory(question: string): 'workspace' | 'user' {
  return /\b(my|i prefer|for me)\b/i.test(question) ? 'user' : 'workspace'
}

function candidateFromFact(kind: string, key: string, value: string, confidence = 0.76): MemoryCandidate {
  return {
    scope: 'workspace',
    kind,
    key: slugKey(key),
    value: cleanText(value),
    confidence,
    source: 'assistant_operational_analysis',
  }
}

function deriveMemoryCandidates(input: {
  question: string
  grounded: AiGroundedAnswer
}): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = []
  const explicit = extractExplicitMemoryStatement(input.question)

  if (explicit) {
    candidates.push({
      scope: scopeForExplicitMemory(input.question),
      kind: /client|customer|account/i.test(explicit) ? 'client_context' : 'preference',
      key: slugKey(explicit),
      value: explicit,
      confidence: 0.9,
      source: 'explicit_user_memory',
    })
  }

  const bottlenecks = Array.isArray(input.grounded.facts.bottlenecks) ? input.grounded.facts.bottlenecks : []
  for (const item of bottlenecks.slice(0, 4)) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as { label?: unknown; impact?: unknown }
    const label = typeof candidate.label === 'string' ? candidate.label : ''
    const impact = typeof candidate.impact === 'string' ? candidate.impact : ''
    if (label && impact) {
      candidates.push(candidateFromFact('operational_bottleneck', label, `${label}: ${impact}`, 0.82))
    }
  }

  const topFollowUps = Array.isArray(input.grounded.facts.topFollowUps) ? input.grounded.facts.topFollowUps : []
  for (const item of topFollowUps.slice(0, 3)) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as { client?: unknown; inactiveDays?: unknown }
    if (typeof candidate.client === 'string' && typeof candidate.inactiveDays === 'number') {
      candidates.push(
        candidateFromFact(
          'client_follow_up',
          candidate.client,
          `${candidate.client} needs follow-up after ${candidate.inactiveDays} days without visible activity.`,
          0.74
        )
      )
    }
  }

  const unavailableMetrics = Array.isArray(input.grounded.facts.unavailableMetrics) ? input.grounded.facts.unavailableMetrics : []
  for (const metric of unavailableMetrics.slice(0, 5)) {
    if (typeof metric === 'string') {
      candidates.push(candidateFromFact('measurement_gap', metric, `${metric} is not measurable from the current workspace schema.`, 0.7))
    }
  }

  return candidates
}

export async function loadAiMemoryContext(input: {
  question: string
  user: AiSessionUser
  messages?: AiMessageInput[]
}): Promise<AiMemoryContext> {
  if (!canUseWorkspaceMemory(input.user) || !input.user.companyId) {
    return { memoryAvailable: false, memories: [], notes: ['AI memory requires an active workspace.'] }
  }

  try {
    const records = await prisma.aiMemory.findMany({
      where: {
        companyId: input.user.companyId,
        OR: [
          { scope: 'workspace' },
          { scope: 'user', userId: input.user.id },
        ],
      },
      orderBy: [{ lastSeenAt: 'desc' }],
      take: 40,
    })

    const scored = records
      .map((record) => ({
        record,
        score: overlapScore(input.question, `${record.kind} ${record.key} ${record.value}`),
      }))
      .sort((a, b) => b.score - a.score || b.record.lastSeenAt.getTime() - a.record.lastSeenAt.getTime())

    const memories: AiMemoryItem[] = scored.slice(0, MEMORY_LIMIT).map(({ record }) => ({
      id: record.id,
      scope: record.scope === 'user' ? 'user' : 'workspace',
      kind: record.kind,
      key: record.key,
      value: record.value,
      confidence: record.confidence,
      lastSeenAt: record.lastSeenAt.toISOString(),
    }))

    return {
      memoryAvailable: true,
      memories,
      notes: records.length ? [] : ['No long-term AI memories have been recorded for this scope yet.'],
    }
  } catch (error) {
    console.warn('[ai-memory] Memory read unavailable:', error)
    return {
      memoryAvailable: false,
      memories: [],
      notes: ['Persistent AI memory is unavailable until the AI memory migration is applied.'],
    }
  }
}

async function getOrCreateConversation(input: {
  user: AiSessionUser
  conversationId?: string | null
  question: string
}) {
  if (!input.user.companyId) return null

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
      title: cleanText(input.question, 90),
      context: Prisma.JsonNull,
    },
    select: { id: true },
  })

  return conversation.id
}

async function upsertMemory(input: {
  user: AiSessionUser
  candidate: MemoryCandidate
}) {
  if (!input.user.companyId) return null

  const userId = input.candidate.scope === 'user' ? input.user.id : null
  const existing = await prisma.aiMemory.findFirst({
    where: {
      companyId: input.user.companyId,
      userId,
      scope: input.candidate.scope,
      kind: input.candidate.kind,
      key: input.candidate.key,
    },
    select: { id: true },
  })

  const data = {
    value: input.candidate.value,
    confidence: input.candidate.confidence,
    source: input.candidate.source,
    lastSeenAt: new Date(),
  }

  if (existing) {
    return prisma.aiMemory.update({
      where: { id: existing.id },
      data,
      select: { id: true, value: true, kind: true, scope: true },
    })
  }

  return prisma.aiMemory.create({
    data: {
      companyId: input.user.companyId,
      userId,
      scope: input.candidate.scope,
      kind: input.candidate.kind,
      key: input.candidate.key,
      ...data,
    },
    select: { id: true, value: true, kind: true, scope: true },
  })
}

export async function persistAiTurn(input: {
  user: AiSessionUser
  conversationId?: string | null
  question: string
  answer: string
  grounded: AiGroundedAnswer
}) {
  if (!canUseWorkspaceMemory(input.user) || !input.user.companyId) {
    return {
      memoryAvailable: false,
      conversationId: null,
      remembered: [],
      notes: ['AI memory requires an active workspace.'],
    }
  }

  try {
    const conversationId = await getOrCreateConversation({
      user: input.user,
      conversationId: input.conversationId,
      question: input.question,
    })
    if (!conversationId) {
      return { memoryAvailable: false, conversationId: null, remembered: [], notes: ['Conversation memory was not created.'] }
    }

    await prisma.$transaction([
      prisma.aiMessage.create({
        data: {
          conversationId,
          role: 'user',
          content: cleanText(input.question, 4000),
          intent: input.grounded.intent,
          citations: Prisma.JsonNull,
        },
      }),
      prisma.aiMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: cleanText(input.answer, 6000),
          intent: input.grounded.intent,
          citations: input.grounded.citations as Prisma.InputJsonValue,
        },
      }),
      prisma.aiConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ])

    const remembered = []
    for (const candidate of deriveMemoryCandidates({ question: input.question, grounded: input.grounded }).slice(0, 8)) {
      const memory = await upsertMemory({ user: input.user, candidate })
      if (memory) remembered.push(memory)
    }

    return {
      memoryAvailable: true,
      conversationId,
      remembered,
      notes: remembered.length ? [] : ['No durable memory candidates were detected in this turn.'],
    }
  } catch (error) {
    console.warn('[ai-memory] Memory write unavailable:', error)
    return {
      memoryAvailable: false,
      conversationId: null,
      remembered: [],
      notes: ['Persistent AI memory is unavailable until the AI memory migration is applied.'],
    }
  }
}
