import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { prisma } from '@/lib/db'
import { getAuthSecret } from '@/lib/env'
import { NO_STORE_HEADERS } from '@/lib/http'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { requireSessionUser } from '@/modules/shared/session'
import { logger } from '@/modules/shared/logger'

export const runtime = 'nodejs'

type PresenceBody = {
  event?: string
  path?: string
}

export async function POST(req: NextRequest) {
  const user = await requireSessionUser(req)

  if (!user.companyId || user.role === 'SUPER_ADMIN') {
    return NextResponse.json({ tracked: false }, { headers: NO_STORE_HEADERS })
  }

  let body: PresenceBody = {}
  try {
    body = (await req.json()) as PresenceBody
  } catch {
    body = {}
  }

  const token = await getToken({
    req: { headers: req.headers } as Parameters<typeof getToken>[0]['req'],
    secret: getAuthSecret(),
    secureCookie: process.env.NODE_ENV === 'production',
  })
  const jti = typeof token?.jti === 'string' ? token.jti : null
  const now = new Date()

  if (jti) {
    await prisma.authSession
      .updateMany({
        where: {
          userId: user.id,
          jti,
          status: 'ACTIVE',
          expiresAt: { gt: now },
        },
        data: { lastSeenAt: now },
      })
      .catch((error) => {
        if (isMissingDatabaseObjectError(error)) return
        throw error
      })
  }

  if (body.event === 'workspace_open') {
    await prisma.activity
      .create({
        data: {
          companyId: user.companyId,
          entityType: 'workspace',
          entityId: user.companyId,
          userId: user.id,
          action: 'workspace.opened',
          source: 'presence_tracker',
          metadata: {
            path: typeof body.path === 'string' ? body.path.slice(0, 240) : null,
          },
        },
      })
      .catch((error) => {
        if (isMissingDatabaseObjectError(error)) {
          logger.warn('presence.workspace_open_skipped_missing_schema', { userId: user.id })
          return
        }
        throw error
      })
  }

  return NextResponse.json({ tracked: true }, { headers: NO_STORE_HEADERS })
}
