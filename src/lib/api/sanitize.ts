export function sanitizeString(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/\0/g, '')
    .trim()
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value)
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) =>
        typeof v === 'string' ? sanitizeString(v) : v
      )
    } else {
      result[key] = value
    }
  }
  return result as T
}
