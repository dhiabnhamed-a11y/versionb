import { requireSessionUser } from '@/modules/shared/session'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getFirebaseProjectDiagnostics } from '@/lib/firebase-admin'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'

type PushTokenBody = {
  token?: string
  previousToken?: string
  client?: {
    projectId?: string | null
    messagingSenderId?: string | null
    appSenderId?: string | null
    notificationPermission?: string | null
    serviceWorkerPath?: string | null
  }
}

export const runtime = 'nodejs'

function pushStorageUnavailable() {
  return NextResponse.json({
    ok: false,
    disabled: true,
    reason: 'push-token-storage-unavailable',
  })
}

function normalizeToken(value?: string) {
  return typeof value === 'string' ? value.trim() : ''
}

function logProjectMismatches(client?: PushTokenBody['client']) {
  const diagnostics = getFirebaseProjectDiagnostics()
  const mismatches = [...diagnostics.mismatches]

  if (client?.projectId && diagnostics.adminProjectId && client.projectId !== diagnostics.adminProjectId) {
    mismatches.push('Posted token was generated with a Firebase project that differs from FIREBASE_PROJECT_ID')
  }

  if (client?.messagingSenderId && client?.appSenderId && client.messagingSenderId !== client.appSenderId) {
    mismatches.push('Posted token sender ID differs from the sender ID encoded in the client app ID')
  }

  if (mismatches.length > 0) {
    console.error('[push-token] Firebase project mismatch detected.', {
      mismatches,
      server: diagnostics,
      client,
    })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser()
    const { token, previousToken, client } = (await req.json()) as PushTokenBody
    const normalizedToken = normalizeToken(token)
    const normalizedPreviousToken = normalizeToken(previousToken)

    if (!normalizedToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    logProjectMismatches(client)

    const userAgent = req.headers.get('user-agent')

    const pushToken = await prisma.pushToken.upsert({
      where: { token: normalizedToken },
      update: {
        userId: user.id,
        userAgent,
        lastUsedAt: new Date(),
      },
      create: {
        token: normalizedToken,
        userId: user.id,
        userAgent,
        lastUsedAt: new Date(),
      },
    })

    if (normalizedPreviousToken && normalizedPreviousToken !== normalizedToken) {
      await prisma.pushToken.deleteMany({
        where: {
          token: normalizedPreviousToken,
          userId: user.id,
        },
      })
    }

    return NextResponse.json({ ok: true, id: pushToken.id })
  } catch (err) {
    console.error(err)
    if (isMissingDatabaseObjectError(err)) {
      return pushStorageUnavailable()
    }

    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await requireSessionUser()
    const tokenCount = await prisma.pushToken.count({
      where: { userId: user.id },
    })

    return NextResponse.json({
      ok: true,
      tokenCount,
      firebase: getFirebaseProjectDiagnostics(),
    })
  } catch (err) {
    console.error(err)
    if (isMissingDatabaseObjectError(err)) {
      return pushStorageUnavailable()
    }

    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireSessionUser()
    const { token } = (await req.json()) as PushTokenBody
    const normalizedToken = normalizeToken(token)

    if (!normalizedToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    await prisma.pushToken.deleteMany({
      where: {
        token: normalizedToken,
        userId: user.id,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    if (isMissingDatabaseObjectError(err)) {
      return pushStorageUnavailable()
    }

    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
