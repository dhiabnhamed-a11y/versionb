export function getDownloadFilename(disposition: string | null, fallback: string, extension = 'pdf') {
  const safeFallback = `${fallback.replace(/[^a-zA-Z0-9._-]/g, '_') || 'invoice'}.${extension}`
  if (!disposition) return safeFallback

  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]).replace(/[\\/:*?"<>|]+/g, '_')
    } catch {
      return safeFallback
    }
  }

  const quotedMatch = disposition.match(/filename="([^"]+)"/i)
  const bareMatch = disposition.match(/filename=([^;]+)/i)
  return (quotedMatch?.[1] || bareMatch?.[1] || safeFallback).trim().replace(/[\\/:*?"<>|]+/g, '_')
}

export async function getResponseErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null)
    if (typeof body?.error === 'string') {
      return body.requestId ? `${body.error} (${body.requestId})` : body.error
    }
  }

  const text = await response.text().catch(() => '')
  return text.trim().slice(0, 240) || fallback
}

export async function downloadBlobResponse(response: Response, fallbackName: string, extension = 'pdf') {
  const blob = await response.blob()
  if (blob.size === 0) throw new Error('Downloaded file was empty.')

  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  try {
    anchor.href = url
    anchor.download = getDownloadFilename(response.headers.get('content-disposition'), fallbackName, extension)
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  }
}
