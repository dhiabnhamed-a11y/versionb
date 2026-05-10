'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, BrainCircuit, ChevronUp, ClipboardList, Loader2, Send, ShieldCheck, Sparkles, X } from 'lucide-react'

type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{
    id: string
    type: string
    label: string
    href?: string
  }>
  quickActions?: string[]
  model?: string
}

type AssistantResponse = {
  id: string
  answer: string
  citations: AssistantMessage['citations']
  quickActions: string[]
  policy: {
    role: string
    scope: string
    financeVisible: boolean
  }
  model: string
  usedModel: boolean
}

const starterPrompts = [
  'What should management focus on today?',
  'Analyze delayed projects',
  'Find overdue invoices',
  'Analyze team workload',
  'Summarize pending approvals',
  'Which clients need follow-up?',
]

function toApiMessages(messages: AssistantMessage[]) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role, content: message.content }))
}

export default function AiOperationsAssistant({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Ask me about operational risks, delayed projects, overdue work, invoices, approvals, clients, or team workload. I only answer from records your role can access.',
      quickActions: starterPrompts,
      model: 'grounded workspace context',
    },
  ])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const latestQuickActions = useMemo(() => messages.findLast((message) => message.quickActions?.length)?.quickActions ?? starterPrompts, [messages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, open])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const submitPrompt = useCallback(
    async (prompt: string) => {
      const message = prompt.trim()
      if (!message || loading || disabled) return

      const userMessage: AssistantMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
      }
      const nextMessages = [...messages, userMessage]
      setMessages(nextMessages)
      setInput('')
      setOpen(true)
      setLoading(true)

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            messages: toApiMessages(nextMessages),
          }),
        })
        const data = (await response.json()) as Partial<AssistantResponse> & { error?: string }

        if (!response.ok) {
          throw new Error(data.error ?? 'Unable to run assistant.')
        }

        setMessages((current) => [
          ...current,
          {
            id: data.id ?? crypto.randomUUID(),
            role: 'assistant',
            content: data.answer ?? 'No grounded answer was returned.',
            citations: data.citations ?? [],
            quickActions: data.quickActions ?? [],
            model: data.model,
          },
        ])
      } catch (error) {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: error instanceof Error ? error.message : 'The assistant is unavailable right now.',
            quickActions: starterPrompts,
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [disabled, loading, messages]
  )

  useEffect(() => {
    function onOpenAssistant(event: Event) {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail
      setOpen(true)
      if (detail?.prompt) {
        void submitPrompt(detail.prompt)
      }
    }

    window.addEventListener('taskit:open-ai-assistant', onOpenAssistant)
    return () => window.removeEventListener('taskit:open-ai-assistant', onOpenAssistant)
  }, [submitPrompt])

  if (disabled) return null

  return (
    <>
      {!open && (
        <button
          type="button"
          className="ai-assistant-launcher"
          onClick={() => setOpen(true)}
          aria-label="Open AI operations assistant"
          title="AI operations assistant"
        >
          <BrainCircuit size={20} />
          <span>AI</span>
        </button>
      )}

      {open && (
        <section className="ai-assistant-panel" aria-label="AI operations assistant">
          <header className="ai-assistant-header">
            <div className="ai-assistant-title">
              <span className="ai-assistant-mark">
                <Bot size={18} />
              </span>
              <span>
                <strong>Operations AI</strong>
                <small>Grounded workspace intelligence</small>
              </span>
            </div>
            <div className="ai-assistant-header-actions">
              <span className="ai-assistant-policy" title="Role-based data access is enforced server-side">
                <ShieldCheck size={13} />
                Scoped
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close AI assistant">
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="ai-assistant-suggestions" aria-label="Suggested AI quick actions">
            {latestQuickActions.slice(0, 4).map((prompt) => (
              <button key={prompt} type="button" onClick={() => submitPrompt(prompt)} disabled={loading}>
                <Sparkles size={13} />
                <span>{prompt}</span>
              </button>
            ))}
          </div>

          <div ref={scrollRef} className="ai-assistant-messages">
            {messages.map((message) => (
              <article key={message.id} className={`ai-assistant-message ${message.role}`}>
                <div className="ai-assistant-message-body">{message.content}</div>
                {message.citations?.length ? (
                  <div className="ai-assistant-citations">
                    <ClipboardList size={13} />
                    {message.citations.slice(0, 4).map((citation) =>
                      citation.href ? (
                        <a key={`${citation.type}-${citation.id}`} href={citation.href}>
                          {citation.label}
                        </a>
                      ) : (
                        <span key={`${citation.type}-${citation.id}`}>{citation.label}</span>
                      )
                    )}
                  </div>
                ) : null}
                {message.model && message.role === 'assistant' ? <div className="ai-assistant-model">{message.model}</div> : null}
              </article>
            ))}
            {loading && (
              <div className="ai-assistant-thinking">
                <Loader2 size={15} />
                Reading workspace records...
              </div>
            )}
          </div>

          <form
            className="ai-assistant-composer"
            onSubmit={(event) => {
              event.preventDefault()
              void submitPrompt(input)
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              rows={2}
              placeholder="Ask about revenue, risks, workload, clients, approvals..."
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void submitPrompt(input)
                }
              }}
            />
            <button type="submit" disabled={!input.trim() || loading} aria-label="Send message">
              {loading ? <ChevronUp size={16} /> : <Send size={16} />}
            </button>
          </form>
        </section>
      )}
    </>
  )
}

