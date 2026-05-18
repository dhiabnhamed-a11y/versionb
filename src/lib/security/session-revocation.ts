import { createHash } from 'crypto'
import { prisma } from '@/lib/db'

export function sessionJtiFromToken(jti: string | undefined | null) {
  if (!jti || typeof jti !== 'string') return null
  return jti
}

export async function isSessionJtiRevoked(jti: string) {
  const row = await prisma.revokedToken.findUnique({
    where: { jti },
    select: { id: true, expiresAt: true },
  })
  if (!row) return false
  if (row.expiresAt.getTime() < Date.now()) return false
  return true
}

export async function revokeSessionJti(input: {
  jti: string
  userId: string
  companyId?: string | null
  reason: string
  expiresAt: Date
}) {
  await prisma.revokedToken.upsert({
    where: { jti: input.jti },
    create: {
      jti: input.jti,
      userId: input.userId,
      companyId: input.companyId ?? undefined,
      reason: input.reason,
      expiresAt: input.expiresAt,
    },
    update: {
      reason: input.reason,
      revokedAt: new Date(),
      expiresAt: input.expiresAt,
    },
  })
}

export async function revokeAllUserSessions(userId: string, reason: string) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30)
  await prisma.authSession.updateMany({
    where: { userId, status: 'ACTIVE' },
    data: { status: 'REVOKED', revokedAt: new Date() },
  })
  const sessions = await prisma.authSession.findMany({
    where: { userId },
    select: { jti: true },
  })
  await Promise.all(
    sessions
      .map((s) => s.jti)
      .filter((jti): jti is string => Boolean(jti))
      .map((jti) => revokeSessionJti({ jti, userId, reason, expiresAt }))
  )
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
