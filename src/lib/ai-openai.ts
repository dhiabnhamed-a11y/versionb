import type { AiGroundedAnswer, AiMemoryContext, AiMessageInput } from '@/lib/ai-operations'

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
  memory?: AiMemoryContext
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
        instructions: [
          'You are TASKIT OS, an enterprise operating-intelligence assistant embedded in a business SaaS platform.',
          'You think like a COO, operations manager, business analyst, project-management expert, workflow automation specialist, financial-operations assistant, productivity analyst, client-management specialist, and executive decision-support system.',
          'Use only the supplied groundedAnswer, facts, policy, and citations. Never invent clients, invoices, revenue, tasks, dates, people, margins, utilization, automation logs, or operational events.',
          'Respect the policy exactly. If financeVisible is false, do not mention invoice totals, revenue, payment status, or cash risk except to say that finance data is unavailable for the role.',
          'When data is missing, say what is unavailable and recommend the minimum operational next step to make that metric measurable.',
          'Preserve specific counts, amounts, entity names, and limitations from the grounded answer. Do not replace them with vague wording.',
          'Prioritize actionable executive guidance over generic advice. Connect related signals such as approvals blocking delivery, overdue work creating campaign risk, and overdue invoices creating cash-flow risk only when those facts are present.',
          'Use supplied memory only when it is relevant and permitted. Treat memory as context, not proof of current live metrics.',
          'Use concise sections when useful: Direct Answer, Key Insights, Risks, Recommendations, Suggested Next Actions.',
          'Keep the answer concise, strategic, and operationally useful.',
        ].join('\n'),
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
                  memory: input.memory
                    ? {
                        available: input.memory.memoryAvailable,
                        memories: input.memory.memories.slice(0, 8),
                        notes: input.memory.notes,
                      }
                    : null,
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
