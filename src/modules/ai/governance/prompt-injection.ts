const INJECTION_PATTERNS = [
  /ignore (all )?(previous|system|developer) instructions/i,
  /reveal (the )?(system|developer) prompt/i,
  /bypass (approval|policy|permission|rbac)/i,
  /execute without (confirmation|approval)/i,
]

export function detectPromptInjection(input: string) {
  const matches = INJECTION_PATTERNS.filter((pattern) => pattern.test(input)).map((pattern) => pattern.source)
  return {
    safe: matches.length === 0,
    matches,
    severity: matches.length ? 'HIGH' : 'LOW',
  }
}
