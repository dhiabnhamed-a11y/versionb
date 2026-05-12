import { ProviderError } from '@/modules/integrations/core/errors'
import type { ProviderRequestContext } from '@/modules/integrations/core/types'
import { recordProviderCooldown, waitForProviderSlot } from '@/modules/integrations/services/rate-limit.service'

type ProviderFetchOptions = RequestInit & {
  context: ProviderRequestContext
  accessToken?: string
  rateLimitWeight?: number
  expectedStatuses?: number[]
}

function retryDelay(attempt: number) {
  return Math.min(500 * 2 ** attempt, 4_000)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function parseResponse(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export async function providerFetchJson<T>(url: string, options: ProviderFetchOptions): Promise<T> {
  const { context, accessToken, rateLimitWeight = 1, expectedStatuses = [200], headers, ...init } = options

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForProviderSlot(context, rateLimitWeight)

    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(headers ?? {}),
      },
    })

    if (expectedStatuses.includes(response.status)) {
      return (await parseResponse(response)) as T
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after') ?? 0) || 60
      await recordProviderCooldown(context.providerSlug, context.companyId, retryAfter)
      throw new ProviderError(context.providerSlug, 'RATE_LIMITED', `${context.providerSlug} returned a rate limit response.`, {
        retryAfterSeconds: retryAfter,
      }, 429)
    }

    if (response.status >= 500 && attempt < 2) {
      await sleep(retryDelay(attempt))
      continue
    }

    const payload = await parseResponse(response)
    throw new ProviderError(context.providerSlug, 'PROVIDER_UNAVAILABLE', `${context.providerSlug} API request failed.`, {
      url,
      status: response.status,
      payload,
    })
  }

  throw new ProviderError(context.providerSlug, 'PROVIDER_UNAVAILABLE', `${context.providerSlug} API request failed.`)
}

export async function providerPostForm<T>(url: string, body: URLSearchParams, options: ProviderFetchOptions): Promise<T> {
  return providerFetchJson<T>(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(options.headers ?? {}),
    },
    body,
  })
}
