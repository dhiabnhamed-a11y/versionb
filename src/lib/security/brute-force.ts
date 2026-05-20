import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'
import { logger } from '@/modules/shared/logger'
import type { RateLimitResult } from '@/modules/shared/rate-limit'

const LOCKOUT_WINDOW_MS = 15 * 60_000
const MAX_FAILURES = 8

function hashEmail(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

export async function enforceAuthRateLimit(req: Request, namespace: string): Promise<RateLimitResult> {
  return enforceDistributedRateLimit(req, {
    namespace,
    windowMs: 60_000,
    max: 12,
  })
}

export async function assertLoginNotLocked(email: string) {
  const emailHash = hashEmail(email)
  try {
    const failures = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "auth_login_attempts"
      WHERE "emailHash" = ${emailHash}
        AND "success" = false
        AND "createdAt" >= NOW() - INTERVAL '15 minutes'
    `
    const count = Number(failures[0]?.count ?? 0)
    if (count >= MAX_FAILURES) {
      throw {
        code: 'AUTH_LOCKED',
        expose: true,
        message: 'Too many failed attempts. Try again in 15 minutes.',
        status: 429,
      }
    }
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) return
    if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'AUTH_LOCKED') {
      throw error
    }
    logger.error('auth.brute_force_check_failed', error, { emailHash })
  }
}

export { LOCKOUT_WINDOW_MS, MAX_FAILURES }
