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
  const requestId = response.headers.get('x-request-id')

  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null)
    if (typeof body?.error === 'string') {
      return body.requestId ? `${body.error} (${body.requestId})` : body.error
    }
  }

  const text = await response.text().catch(() => '')
  const message = text.trim().slice(0, 240) || fallback
  return requestId ? `${message} (${requestId})` : message
}

async function assertPdfBlob(blob: Blob) {
  if (blob.size === 0) throw new Error('Downloaded file was empty.')

  const signature = new TextDecoder('ascii').decode(await blob.slice(0, 5).arrayBuffer())
  if (signature !== '%PDF-') {
    throw new Error('Downloaded file was not a valid PDF.')
  }
}

export async function downloadBlobResponse(response: Response, fallbackName: string, extension = 'pdf') {
  const blob = await response.blob()
  if (extension === 'pdf') await assertPdfBlob(blob)
  else if (blob.size === 0) throw new Error('Downloaded file was empty.')

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

export async function downloadPdfFromApi(url: string, fallbackName: string, context: Record<string, unknown> = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 60000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        Accept: 'application/pdf',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    })
    const contentType = response.headers.get('content-type') ?? ''
    const requestId = response.headers.get('x-request-id')

    if (!response.ok || !contentType.includes('application/pdf')) {
      const message = await getResponseErrorMessage(response, 'Invoice PDF could not be downloaded.')
      console.error('[invoice-download]', {
        ...context,
        url,
        status: response.status,
        contentType,
        requestId,
        message,
      })
      throw new Error(message)
    }

    await downloadBlobResponse(response, fallbackName)
    console.info('[invoice-download]', {
      ...context,
      url,
      status: response.status,
      contentType,
      requestId,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('[invoice-download]', { ...context, url, message: 'PDF request timed out.' })
      throw new Error('Invoice PDF generation timed out. Please try again.')
    }

    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
