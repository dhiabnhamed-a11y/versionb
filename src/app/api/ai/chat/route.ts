import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buildGroundedOperationalAnswer, type AiMessageInput } from '@/lib/ai-operations'
import { polishGroundedAnswerWithOpenAi } from '@/lib/ai-openai'
import { loadAiMemoryContext, persistAiTurn } from '@/lib/ai-memory'
import { NO_STORE_HEADERS } from '@/lib/http'
import { normalizeAppLocale } from '@/lib/i18n'

type SessionUser = {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
  companyId?: string | null
}

type ChatBody = {
  message?: string
  messages?: AiMessageInput[]
  conversationId?: string
  locale?: string
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
    .slice(-12)
}

function cleanConversationId(value: unknown) {
  return typeof value === 'string' && /^[a-z0-9_-]{8,80}$/i.test(value) ? value : null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  const body = (await req.json().catch(() => ({}))) as ChatBody
  const message = cleanMessage(body.message)
  const messages = cleanMessages(body.messages)
  const conversationId = cleanConversationId(body.conversationId)
  const locale = normalizeAppLocale(body.locale)

  if (!message) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  const memory = await loadAiMemoryContext({
    question: message,
    messages,
    user,
  })

  const grounded = await buildGroundedOperationalAnswer({
    question: message,
    messages,
    memory,
    user,
  })
  const polished = await polishGroundedAnswerWithOpenAi({ question: message, messages, grounded, memory, locale })
  const memoryWrite = await persistAiTurn({
    user,
    conversationId,
    question: message,
    answer: polished.answer,
    grounded,
  })

  return NextResponse.json(
    {
      id: crypto.randomUUID(),
      conversationId: memoryWrite.conversationId ?? conversationId,
      answer: polished.answer,
      intent: grounded.intent,
      confidence: grounded.confidence,
      citations: grounded.citations,
      quickActions: grounded.quickActions,
      policy: grounded.policy,
      model: polished.model,
      usedModel: polished.usedModel,
      locale,
      memory: {
        available: memory.memoryAvailable && memoryWrite.memoryAvailable,
        recalled: memory.memories.length,
        remembered: memoryWrite.remembered.length,
        notes: [...memory.notes, ...memoryWrite.notes],
      },
      generatedAt: new Date().toISOString(),
    },
    { headers: NO_STORE_HEADERS }
  )
}
