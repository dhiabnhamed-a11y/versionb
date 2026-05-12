import type { NextRequest } from 'next/server'
import { logger } from '@/modules/shared/logger'

type OAuthOriginResolution = {
  origin: string
  requestOrigin: string | null
  source: string
  configuredOrigin: string | null
  allowedOrigins: string[]
}

type OAuthOriginInput = {
  req: NextRequest
  preferredEnvKeys?: string[]
}

const DEFAULT_PREFERRED_ENV_KEYS = [
  'SOCIAL_OAUTH_BASE_URL',
  'OAUTH_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'APP_URL',
  'AUTH_URL',
  'NEXTAUTH_URL',
] as const

function cleanEnvValue(value?: string | null) {
  return value?.trim().replace(/^['"]|['"]$/g, '') || null
}

function normalizeOrigin(value?: string | null) {
  const clean = cleanEnvValue(value)
  if (!clean) return null

  try {
    const url = new URL(clean.startsWith('http://') || clean.startsWith('https://') ? clean : `https://${clean}`)
    return url.origin
  } catch {
    return null
  }
}

function envOrigin(keys: readonly string[]) {
  for (const key of keys) {
    const origin = normalizeOrigin(process.env[key])
    if (origin) return { origin, source: key }
  }
  return null
}

function platformOrigin() {
  const vercelUrl = normalizeOrigin(process.env.VERCEL_URL)
  if (vercelUrl) return { origin: vercelUrl, source: 'VERCEL_URL' }

  const cloudflarePagesUrl = normalizeOrigin(process.env.CF_PAGES_URL)
  if (cloudflarePagesUrl) return { origin: cloudflarePagesUrl, source: 'CF_PAGES_URL' }

  return null
}

function forwardedRequestOrigin(req: NextRequest) {
  const headerHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (headerHost) {
    const headerProto = req.headers.get('x-forwarded-proto') ?? (isLocalHost(headerHost) ? 'http' : 'https')
    const normalized = normalizeOrigin(`${headerProto}://${headerHost}`)
    if (normalized) return normalized
  }

  if (req.nextUrl.origin && req.nextUrl.origin !== 'null') {
    return normalizeOrigin(req.nextUrl.origin)
  }

  return null
}

function isLocalHost(value: string) {
  let host = value
  try {
    host = new URL(value.startsWith('http://') || value.startsWith('https://') ? value : `http://${value}`).hostname
  } catch {
    host = value.replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0] ?? value
  }
  const normalized = host.toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]'
}

function isLocalOrigin(origin: string | null) {
  return Boolean(origin && isLocalHost(origin))
}

export function oauthAllowedOrigins() {
  return (cleanEnvValue(process.env.OAUTH_ALLOWED_ORIGINS) ?? '')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin))
}

export function resolveOAuthOrigin(input: OAuthOriginInput): OAuthOriginResolution {
  const preferredEnvKeys = input.preferredEnvKeys?.length ? input.preferredEnvKeys : [...DEFAULT_PREFERRED_ENV_KEYS]
  const requestOrigin = forwardedRequestOrigin(input.req)
  const allowedOrigins = oauthAllowedOrigins()
  const configured = envOrigin(preferredEnvKeys)
  const platform = platformOrigin()

  if (requestOrigin && isLocalOrigin(requestOrigin)) {
    return {
      origin: requestOrigin,
      requestOrigin,
      source: 'request-localhost',
      configuredOrigin: configured?.origin ?? null,
      allowedOrigins,
    }
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return {
      origin: requestOrigin,
      requestOrigin,
      source: 'request-allowed-origin',
      configuredOrigin: configured?.origin ?? null,
      allowedOrigins,
    }
  }

  if (configured) {
    return {
      origin: configured.origin,
      requestOrigin,
      source: configured.source,
      configuredOrigin: configured.origin,
      allowedOrigins,
    }
  }

  if (platform) {
    return {
      origin: platform.origin,
      requestOrigin,
      source: platform.source,
      configuredOrigin: null,
      allowedOrigins,
    }
  }

  return {
    origin: requestOrigin ?? 'http://localhost:3000',
    requestOrigin,
    source: requestOrigin ? 'request-origin' : 'localhost-fallback',
    configuredOrigin: null,
    allowedOrigins,
  }
}

export function buildOAuthCallbackUrl(input: OAuthOriginInput & { path: string }) {
  const resolution = resolveOAuthOrigin(input)
  const url = new URL(input.path, resolution.origin)
  return { url: url.toString(), resolution }
}

export function logOAuthUrlResolution(event: string, payload: Record<string, unknown>) {
  if (process.env.OAUTH_DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
    logger.info(event, payload)
  }
}
