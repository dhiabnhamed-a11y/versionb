import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { buildGroundedOperationalAnswer, type AiMessageInput } from '@/lib/ai-operations'
import { polishGroundedAnswerWithOpenAi } from '@/lib/ai-openai'
import { loadAiMemoryContext, persistAiTurn } from '@/lib/ai-memory'
import {
  ensureAiConversationForState,
  handleAiConversationStateTurn,
  syncConversationStateFromGrounded,
} from '@/lib/ai-conversation-state'
import { API_RATE_LIMITS } from '@/lib/api-defaults'
import { NO_STORE_HEADERS } from '@/lib/http'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'
import { normalizeAppLocale } from '@/lib/i18n'

export const runtime = 'nodejs'

type ChatBody = {
  message?: string
  messages?: AiMessageInput[]
  conversationId?: string
  locale?: string
  confirmationToken?: string
}

function cleanMessage(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 4000) : ''
}

function cleanMessages(messages: unknown): AiMessageInput[] {
  if (!Array.isArray(messages)) return []

  return messages
    .map((message) => {
      if (!message || typeof message !== 'object') return null
      const candidate = message as Partial<AiMessageInput>
      const role = candidate.role === 'assistant' ? 'assistant' : 'user'
      const content = cleanMessage(candidate.content)
      if (!content) return null
      return { role, content }
    })
    .filter((message): message is AiMessageInput => Boolean(message))
    .slice(-20)
}

function cleanConversationId(value: unknown) {
  return typeof value === 'string' && /^[a-z0-9_-]{8,80}$/i.test(value) ? value : null
}

function cleanConfirmationToken(value: unknown) {
  return typeof value === 'string' && /^[a-z0-9_-]{24,160}$/i.test(value.trim()) ? value.trim() : null
}

export async function POST(req: NextRequest) {
  const rateLimit = await enforceDistributedRateLimit(req, API_RATE_LIMITS.ai)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE_HEADERS })
  }

  const user = await requireSessionUser()
  const body = (await req.json().catch(() => ({}))) as ChatBody
  const message = cleanMessage(body.message)
  const messages = cleanMessages(body.messages)
  const conversationId = cleanConversationId(body.conversationId)
  const locale = normalizeAppLocale(body.locale)
  const confirmationToken = cleanConfirmationToken(body.confirmationToken)
  const question = message || (confirmationToken ? 'Confirm AI action' : '')

  if (!question) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  const durableConversationId = await ensureAiConversationForState({
    user,
    conversationId,
    question,
  })

  const memory = await loadAiMemoryContext({
    question,
    messages,
    user,
  })

  const stateTurn = await handleAiConversationStateTurn({
    question,
    user,
    conversationId: durableConversationId ?? conversationId,
    confirmationToken,
  })

  const grounded = stateTurn.handled && stateTurn.grounded
    ? stateTurn.grounded
    : await buildGroundedOperationalAnswer({
        question,
        messages,
        memory,
        user,
        confirmationToken,
        conversationId: durableConversationId ?? conversationId,
      })
  const keepDeterministic = Boolean(grounded.ambiguity || grounded.facts.actionPreview)
  const polished = keepDeterministic
    ? {
        answer: grounded.answer,
        model: 'deterministic-grounded-engine',
        usedModel: false,
      }
    : await polishGroundedAnswerWithOpenAi({ question, messages, grounded, memory, locale })
  const memoryWrite = await persistAiTurn({
    user,
    conversationId: durableConversationId ?? conversationId,
    question,
    answer: polished.answer,
    grounded,
  })
  const conversationState = stateTurn.state ?? await syncConversationStateFromGrounded({
    user,
    conversationId: memoryWrite.conversationId ?? durableConversationId ?? conversationId,
    grounded,
  })

  return NextResponse.json(
    {
      id: crypto.randomUUID(),
      conversationId: memoryWrite.conversationId ?? durableConversationId ?? conversationId,
      answer: polished.answer,
      intent: grounded.intent,
      confidence: grounded.confidence,
      citations: grounded.citations,
      quickActions: grounded.quickActions,
      policy: grounded.policy,
      actionPreview: grounded.facts.actionPreview ?? null,
      executionReceipt: grounded.facts.executionReceipt ?? null,
      model: polished.model,
      usedModel: polished.usedModel,
      language: grounded.language ?? locale,
      dir: grounded.dir ?? (locale === 'ar' ? 'rtl' : 'ltr'),
      intentResolution: grounded.resolvedIntent
        ? {
            type: grounded.resolvedIntent.type,
            entity: grounded.resolvedIntent.entity,
            entityId: grounded.resolvedIntent.entityId,
            entityName: grounded.resolvedIntent.entityName,
            confidence: grounded.resolvedIntent.confidence,
            language: grounded.resolvedIntent.language,
            ambiguous: grounded.resolvedIntent.ambiguous,
            alternatives: grounded.resolvedIntent.alternatives ?? [],
          }
        : null,
      ambiguity: grounded.ambiguity ?? null,
      locale,
      memory: {
        available: memory.memoryAvailable && memoryWrite.memoryAvailable,
        recalled: memory.memories.length,
        remembered: memoryWrite.remembered.length,
        notes: [...memory.notes, ...memoryWrite.notes],
      },
      conversationState: conversationState ?? grounded.facts.conversationState ?? null,
      generatedAt: new Date().toISOString(),
    },
    { headers: NO_STORE_HEADERS }
  )
}
