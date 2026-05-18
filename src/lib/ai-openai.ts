import type { AiGroundedAnswer, AiMemoryContext, AiMessageInput } from '@/lib/ai-operations'
import { DEFAULT_LOCALE, type AppLocale } from '@/lib/i18n'

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

function languageName(locale: AppLocale) {
  if (locale === 'fr') return 'French'
  if (locale === 'ar') return 'Arabic'
  return 'English'
}

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
  locale?: AppLocale
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
  const timeout = setTimeout(() => controller.abort(), 45_000)
  const locale = input.locale ?? DEFAULT_LOCALE

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
        max_output_tokens: 2800,
        reasoning: { effort: 'high' },
        instructions: [
          'You are TASKIT OS Brain — a senior operations copilot with deep overthinking before you answer.',
          'Think step-by-step internally: interpret intent, check policy scope, cross-link facts, surface risks, then choose the best workflow or action path.',
          'Roles: COO, PMO lead, finance controller, client success director, automation architect, and executive advisor combined.',
          'Use ONLY groundedAnswer, facts, policy, citations, memory. Never invent records, amounts, people, dates, or outcomes.',
          'If financeVisible is false, do not expose invoice/revenue/cash metrics except to state finance is role-restricted.',
          'When data is missing, name the gap, why it matters operationally, and the smallest next step to unblock measurement.',
          'Preserve every count, ID, entity name, status, and limitation from grounded data — never dilute into vague summaries.',
          `Reply in ${languageName(locale)}. Arabic: natural RTL prose; keep entity names, IDs, invoice numbers, and currencies exact.`,
          'Format with bold section headers and rich detail. Required sections when relevant:',
          '**Direct Answer** — clear verdict in 2–4 sentences.',
          '**Operational Reasoning** — how you connected signals (cause → effect → impact).',
          '**Key Insights** — bullet facts with numbers and entity names.',
          '**Risks** — ranked operational/financial/delivery risks from evidence.',
          '**Workflow Path** — which workflow applies (create client/campaign/brief/invoice, mark paid, delete, alert, analyze) and current step.',
          '**Recommendations** — prioritized actions with owner hints (manager, finance, producer).',
          '**Execution Checklist** — numbered steps the user can take now in TASKIT.',
          '**Suggested Next Actions** — 3–6 concrete follow-up prompts.',
          'For completed actions: recap what changed, list field values, permissions used, and immediate follow-ups.',
          'For ambiguous requests: state top interpretation, alternatives considered, and the one missing field to proceed.',
          'Be thorough and detailed — executives prefer depth over brevity. Use bullets and short paragraphs, not walls of text.',
          'Support all workspace workflows: analysis, creation, updates, deletions, alerts, approvals, workload, finance, clients, memory recall.',
        ].join('\n'),
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  locale,
                  question: input.question,
                  recentMessages: input.messages?.slice(-14) ?? [],
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
