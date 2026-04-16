import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isFirebaseAdminConfigured, sendNotification } from '@/lib/firebase-admin'

type SessionUser = {
  id: string
  role: string
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
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser

  try {
    const alerts = await prisma.alert.findMany({
      where: { recipientId: user.id },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(alerts)
  } catch (err) {
    console.error(err)
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

    // Emit real-time event via Socket.io global instance
    if (global.io) {
      global.io.to(`user:${recipientId}`).emit('alert', {
        id: alert.id,
        type: alert.type,
        title: alert.title,
        message: alert.message,
        sender: alert.sender,
        createdAt: alert.createdAt,
      })
      console.log(`📢 Alert emitted to user:${recipientId}`)
    }

    // Mirror alerts to FCM so users still receive notifications when TASKIT is backgrounded.
    if (isFirebaseAdminConfigured()) {
      const recipientTokens = await prisma.pushToken.findMany({
        where: { userId: recipientId },
        select: { token: true },
      })

      await Promise.allSettled(
        recipientTokens.map(({ token }) =>
          sendNotification(token, `TASKIT: ${alert.title}`, alert.message, {
            url: '/dashboard/employee/alerts',
            type: alert.type,
            alertId: alert.id,
          })
        )
      )
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
    return NextResponse.json(alert)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
