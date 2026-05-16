import { detectPromptInjection } from '@/modules/ai/governance/prompt-injection'

export function evaluateAiRequestSafety(input: { goal: string; mutating: boolean }) {
  const injection = detectPromptInjection(input.goal)
  const blocked = !injection.safe && input.mutating
  return {
    blocked,
    severity: blocked ? 'CRITICAL' : injection.severity,
    reasons: injection.matches,
  }
}
