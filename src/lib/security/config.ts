const PUBLIC_API_PREFIXES = [
  '/api/auth',
  '/api/health',
  '/api/ready',
  '/api/auth/register',
  '/api/integrations/webhooks',
  '/api/client-portal',
  '/api/invites/',
] as const

export function isPublicApiPath(pathname: string) {
  if (pathname === '/api/health' || pathname === '/api/ready') return true
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === 'production'
}

export function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}
