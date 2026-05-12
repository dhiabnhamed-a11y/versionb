import { createHash, createHmac, randomBytes } from 'crypto'
import type { SocialProviderSlug } from '@/modules/integrations/core/types'
import { badRequest } from '@/modules/shared/errors'
import { base64UrlDecode, base64UrlEncode } from '@/modules/integrations/utils/hash'

export type OAuthStatePayload = {
  nonce: string
  provider: SocialProviderSlug
  companyId: string
  userId: string
  returnTo: string
  issuedAt: number
}

export type OAuthCookiePayload = {
  nonce: string
  provider: SocialProviderSlug
  companyId: string
  userId: string
  codeVerifier: string
  issuedAt: number
}

const STATE_TTL_MS = 10 * 60 * 1000

function signingSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required for OAuth state signing.')
  return secret
}

function sign(value: string) {
  return createHmac('sha256', signingSecret()).update(value).digest('base64url')
}

export function oauthCookieName(provider: SocialProviderSlug) {
  return `taskit_social_oauth_${provider}`
}

export function createPkcePair() {
  const codeVerifier = randomBytes(64).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export function createOAuthState(input: Omit<OAuthStatePayload, 'nonce' | 'issuedAt'>) {
  const payload: OAuthStatePayload = {
    ...input,
    nonce: randomBytes(24).toString('base64url'),
    issuedAt: Date.now(),
  }
  const body = base64UrlEncode(JSON.stringify(payload))
  return { payload, state: `${body}.${sign(body)}` }
}

export function encodeOAuthCookie(payload: OAuthCookiePayload) {
  const body = base64UrlEncode(JSON.stringify(payload))
  return `${body}.${sign(body)}`
}

export function verifyOAuthState(value: string): OAuthStatePayload {
  const [body, signature] = value.split('.')
  if (!body || !signature || sign(body) !== signature) throw badRequest('Invalid OAuth state.')

  const payload = JSON.parse(base64UrlDecode(body)) as OAuthStatePayload
  if (Date.now() - payload.issuedAt > STATE_TTL_MS) throw badRequest('OAuth state expired.')
  return payload
}

export function verifyOAuthCookie(value: string): OAuthCookiePayload {
  const [body, signature] = value.split('.')
  if (!body || !signature || sign(body) !== signature) throw badRequest('Invalid OAuth session.')

  const payload = JSON.parse(base64UrlDecode(body)) as OAuthCookiePayload
  if (Date.now() - payload.issuedAt > STATE_TTL_MS) throw badRequest('OAuth session expired.')
  return payload
}
