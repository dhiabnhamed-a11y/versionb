import { randomBytes } from 'crypto'

export function createClientPortalToken() {
  return randomBytes(32).toString('base64url')
}

export function getAppBaseUrl(request?: Request) {
  const forwardedHost = request?.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request?.headers.get('host')?.trim()
  if (host) {
    const forwardedProto = request?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const proto = forwardedProto || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.NEXTAUTH_URL?.trim()
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : '')
    || 'http://localhost:3000'
  )
}

export function getClientPortalUrl(token: string, request?: Request) {
  return new URL(`/client-portal/${token}`, getAppBaseUrl(request)).href
}

export function cleanPortalText(value: unknown, maxLength = 4000) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}
