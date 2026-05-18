/** Client-safe owner signup hints (mirrors default server blocklist). */
export const BLOCKED_OWNER_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'msn.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
] as const

export function getOwnerEmailDomain(email: string) {
  return email.trim().toLowerCase().split('@')[1] ?? ''
}

export function isBlockedOwnerEmailDomain(email: string) {
  const domain = getOwnerEmailDomain(email)
  return domain ? BLOCKED_OWNER_EMAIL_DOMAINS.includes(domain as (typeof BLOCKED_OWNER_EMAIL_DOMAINS)[number]) : false
}
