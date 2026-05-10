import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import {
  getFirebaseMessagingErrorCode,
  isFirebaseAdminConfigured,
  isFirebaseProjectMismatchError,
  isInvalidFirebaseTokenError,
  sendNotification,
} from '@/lib/firebase-admin'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { emitUserRealtime } from '@/lib/realtime-server'

type SessionUser = {
  id: string
  role: string
  companyId?: string | null
}

type CreateAlertBody = {
  type?: string
  title: string
  message: string
  recipientId: string
}

type MarkAlertReadBody = {
  alertId: string
}

// GET alerts for the current user
export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = session.user as SessionUser

    const alerts = await prisma.alert.findMany({
      where: { recipientId: user.id },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(alerts, { headers: NO_STORE_HEADERS })
  } catch (err) {
    console.error(err)
    if (isMissingDatabaseObjectError(err)) {
      return NextResponse.json([], { headers: NO_STORE_HEADERS })
    }

    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST send an alert to an employee
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { type, title, message, recipientId } = (await req.json()) as CreateAlertBody

    const alert = await prisma.alert.create({
      data: {
        type: type || 'URGENT_TASK',
        title,
        message,
        senderId: user.id,
        recipientId,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        recipient: { select: { id: true, name: true } },
      },
    })

    emitUserRealtime(recipientId, 'alert', {
      id: alert.id,
      type: alert.type,
      title: alert.title,
      message: alert.message,
      read: alert.read,
      sender: alert.sender,
      createdAt: alert.createdAt,
    })

    // Mirror alerts to FCM so users still receive notifications when TASKIT is backgrounded.
    if (isFirebaseAdminConfigured()) {
      let recipientTokens: { token: string }[] = []
      try {
        recipientTokens = await prisma.pushToken.findMany({
          where: { userId: recipientId },
          select: { token: true },
        })
      } catch (err) {
        if (!isMissingDatabaseObjectError(err)) {
          throw err
        }

        console.warn('[alerts] PushToken storage is not available; skipping FCM mirror.')
      }

      const results = await Promise.allSettled(
        recipientTokens.map(({ token }) =>
          sendNotification(token, `TASKIT: ${alert.title}`, alert.message, {
            url: '/dashboard/employee/alerts',
            type: alert.type,
            alertId: alert.id,
          })
        )
      )

      const invalidTokens = results
        .map((result, index) => (result.status === 'rejected' && isInvalidFirebaseTokenError(result.reason) ? recipientTokens[index]?.token : null))
        .filter((token): token is string => Boolean(token))

      const failedResults = results
        .map((result, index) => ({
          result,
          token: recipientTokens[index]?.token,
        }))
        .filter((entry) => entry.result.status === 'rejected')

      if (failedResults.length > 0) {
        console.error('[alerts] FCM mirror failed for one or more tokens.', {
          recipientId,
          failures: failedResults.map(({ result }) => {
            const reason = result.status === 'rejected' ? result.reason : null
            return {
              code: getFirebaseMessagingErrorCode(reason),
              projectMismatch: isFirebaseProjectMismatchError(reason),
            }
          }),
        })
      }

      if (invalidTokens.length > 0) {
        await prisma.pushToken.deleteMany({
          where: {
            userId: recipientId,
            token: { in: invalidTokens },
          },
        })
      }
    }

    return NextResponse.json(alert, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH mark alert as read
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser

  try {
    const { alertId } = (await req.json()) as MarkAlertReadBody
    const alert = await prisma.alert.update({
      where: { id: alertId, recipientId: user.id },
      data: { read: true },
    })
    emitUserRealtime(user.id, 'alert_read', { alertId: alert.id })
    return NextResponse.json(alert)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
