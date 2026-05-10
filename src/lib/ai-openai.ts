import type { AiGroundedAnswer, AiMessageInput } from '@/lib/ai-operations'

type OpenAiResponsePayload = {
  output_text?: string
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
  error?: {
    message?: string
  }
}

const DEFAULT_MODEL = 'gpt-5.5'

function extractOutputText(payload: OpenAiResponsePayload) {
  if (payload.output_text?.trim()) return payload.output_text.trim()

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === 'output_text' && content.text)
      .map((content) => content.text)
      .join('\n')
      .trim() ?? ''
  )
}

export async function polishGroundedAnswerWithOpenAi(input: {
  question: string
  grounded: AiGroundedAnswer
  messages?: AiMessageInput[]
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      answer: input.grounded.answer,
      model: 'deterministic-grounded-engine',
      usedModel: false,
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        store: false,
        instructions:
          'You are TASKIT OS, an operational AI assistant for agency managers. Use only the supplied grounded answer, facts, policy, and citations. Never invent clients, invoices, revenue, tasks, dates, or people. If data is missing or forbidden, say so. Keep the answer concise, executive, and action-oriented.',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  question: input.question,
                  recentMessages: input.messages?.slice(-6) ?? [],
                  groundedAnswer: input.grounded.answer,
                  facts: input.grounded.facts,
                  policy: input.grounded.policy,
                  citations: input.grounded.citations,
                }),
              },
            ],
          },
        ],
      }),
    })

    const payload = (await response.json()) as OpenAiResponsePayload
    if (!response.ok) {
      console.warn('[ai] OpenAI response failed:', payload.error?.message ?? response.statusText)
      return {
        answer: input.grounded.answer,
        model: 'deterministic-grounded-engine',
        usedModel: false,
      }
    }

    const answer = extractOutputText(payload)
    return {
      answer: answer || input.grounded.answer,
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      usedModel: Boolean(answer),
    }
  } catch (error) {
    console.warn('[ai] OpenAI response unavailable:', error)
    return {
      answer: input.grounded.answer,
      model: 'deterministic-grounded-engine',
      usedModel: false,
    }
  } finally {
    clearTimeout(timeout)
  }
}

