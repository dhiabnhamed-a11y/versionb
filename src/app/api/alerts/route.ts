import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET alerts for the current user
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any

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
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { type, title, message, recipientId } = await req.json()

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

    return NextResponse.json(alert, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH mark alert as read
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any

  try {
    const { alertId } = await req.json()
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
