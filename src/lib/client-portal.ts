import { randomBytes } from 'crypto'

export function createClientPortalToken() {
  return randomBytes(32).toString('base64url')
}

export function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.NEXTAUTH_URL?.trim()
    || 'http://localhost:3000'
  )
}

export function getClientPortalUrl(token: string) {
  return new URL(`/client-portal/${token}`, getAppBaseUrl()).href
}

export function cleanPortalText(value: unknown, maxLength = 4000) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}
