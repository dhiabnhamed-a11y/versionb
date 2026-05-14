import { prisma } from '@/lib/db'

const alertSenderSelect = {
  id: true,
  name: true,
  avatar: true,
} as const

export function listAlertsForRecipient(recipientId: string) {
  return prisma.alert.findMany({
    where: { recipientId },
    include: {
      sender: { select: alertSenderSelect },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export function createAlertRecord(input: { message: string; recipientId: string; senderId: string; title: string; type?: string }) {
  return prisma.alert.create({
    data: {
      type: input.type || 'URGENT_TASK',
      title: input.title,
      message: input.message,
      senderId: input.senderId,
      recipientId: input.recipientId,
    },
    include: {
      sender: { select: alertSenderSelect },
      recipient: { select: { id: true, name: true } },
    },
  })
}

export function markAlertReadForRecipient(input: { alertId: string; recipientId: string }) {
  return prisma.alert.update({
    where: { id: input.alertId, recipientId: input.recipientId },
    data: { read: true },
  })
}

export function listPushTokensForUser(userId: string) {
  return prisma.pushToken.findMany({
    where: { userId },
    select: { token: true },
  })
}

export function deletePushTokensForUser(userId: string, tokens: string[]) {
  if (tokens.length === 0) return Promise.resolve({ count: 0 })

  return prisma.pushToken.deleteMany({
    where: {
      userId,
      token: { in: tokens },
    },
  })
}
