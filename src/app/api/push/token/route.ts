import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'

type SessionUser = {
  id: string
}

type PushTokenBody = {
  token?: string
}

function pushStorageUnavailable() {
  return NextResponse.json({
    ok: false,
    disabled: true,
    reason: 'push-token-storage-unavailable',
  })
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as SessionUser
    const { token } = (await req.json()) as PushTokenBody

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent')

    const pushToken = await prisma.pushToken.upsert({
      where: { token },
      update: {
        userId: user.id,
        userAgent,
        lastUsedAt: new Date(),
      },
      create: {
        token,
        userId: user.id,
        userAgent,
        lastUsedAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true, id: pushToken.id })
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
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as SessionUser
    const { token } = (await req.json()) as PushTokenBody

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    await prisma.pushToken.deleteMany({
      where: {
        token,
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
