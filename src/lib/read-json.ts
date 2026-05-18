export async function readJsonResponse<T>(response: Response, fallback: T): Promise<T> {
  const text = await response.text()
  if (!text.trim()) return fallback

  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

export async function readJsonResponseOrThrow<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text.trim()) {
    throw new Error(`Empty response body (HTTP ${response.status}).`)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Invalid JSON response (HTTP ${response.status}).`)
  }
}
