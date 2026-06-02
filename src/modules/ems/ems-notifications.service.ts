import { prisma } from '@/lib/db'
import { sendNotification, isInvalidFirebaseTokenError } from '@/lib/firebase-admin'
import { emitEmsEvent } from './ems-realtime'
import { logger } from '@/modules/shared/logger'

async function purgeStaleToken(tokenId: string, userId: string): Promise<void> {
  try {
    await prisma.pushToken.delete({ where: { id: tokenId, userId } })
    logger.info('ems.push.stale_token_purged', { tokenId, userId })
  } catch { /* already deleted */ }
}

async function sendEmsNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<{ delivered: boolean; staleToken: boolean }> {
  try {
    await sendNotification(token, title, body, {
      ...data,
      channelId: 'ems-critical-alerts', // Android critical channel
      sound: 'ems_alert',               // custom sound registered in mobile app
      priority: 'high',
      ttl: '300',                        // 5 min max for emergencies
    })
    return { delivered: true, staleToken: false }
  } catch (err) {
    if (isInvalidFirebaseTokenError(err)) return { delivered: false, staleToken: true }
    logger.warn('ems.push.send_failed', { error: err })
    return { delivered: false, staleToken: false }
  }
}

export type DispatchNotificationInput = {
  companyId: string
  incidentId: string
  incidentNumber: string
  severity: string
  lat: number
  lng: number
  address?: string | null
  chiefComplaint?: string | null
  unitIds: string[]
  dispatcherId?: string
}

export class EmsNotificationService {
  static async sendDispatchAlert(input: DispatchNotificationInput) {
    const { companyId, incidentId, incidentNumber, severity, lat, lng, address, chiefComplaint, unitIds, dispatcherId } = input

    const title = `🚨 EMS DISPATCH: ${incidentNumber}`
    const message = `[${severity}] ${chiefComplaint || 'Emergency call'} @ ${address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}`

    const results: Array<{ unitId: string; success: boolean; error?: string }> = []

    for (const unitId of unitIds) {
      try {
        const crewMembers = await prisma.emsCrewMember.findMany({
          where: { unitId, status: { not: 'off_duty' } },
          include: { crew: true },
        })

        for (const member of crewMembers) {
          const pushTokens = await prisma.pushToken.findMany({
            where: { userId: member.userId },
          })

          const notifData = {
            type: 'ems_dispatch',
            incidentId,
            incidentNumber,
            severity,
            unitId,
            url: `/dashboard/admin/ems/dispatch`,
            tag: `ems-dispatch-${incidentId}`,
          }

          await Promise.allSettled(
            pushTokens.map(async (pt) => {
              const { delivered, staleToken } = await sendEmsNotification(pt.token, title, message, notifData)
              if (staleToken) await purgeStaleToken(pt.id, member.userId)
              return delivered
            })
          )
        }

        results.push({ unitId, success: true })
      } catch (err) {
        logger.error(`[EMS Notifications] Failed to notify crew of unit ${unitId}`, { error: err })
        results.push({ unitId, success: false, error: String(err) })
      }
    }

    const notification = await prisma.emsNotification.create({
      data: {
        companyId,
        incidentId,
        type: 'dispatch_alert',
        title,
        message,
        channel: 'push',
        recipients: unitIds,
        sentAt: new Date(),
      },
    })

    await emitEmsEvent(companyId, 'ems:dispatch:decision' as any, {
      type: 'dispatch_notification',
      incidentId,
      notificationId: notification.id,
      unitIds,
      severity,
      message,
    })

    return { notification, deliveryResults: results }
  }

  static async sendStatusAlert(
    companyId: string,
    incidentId: string,
    newStatus: string,
    unitNumber?: string
  ) {
    const title = `Incident Status: ${newStatus.replace(/_/g, ' ')}`
    const message = unitNumber
      ? `Unit ${unitNumber} status changed to ${newStatus.replace(/_/g, ' ')}`
      : `Incident status changed to ${newStatus.replace(/_/g, ' ')}`

    await prisma.emsNotification.create({
      data: {
        companyId,
        incidentId,
        type: `status_${newStatus.toLowerCase()}`,
        title,
        message,
        channel: 'realtime',
        sentAt: new Date(),
        recipients: [],
      },
    })

    await emitEmsEvent(companyId, 'ems:incident:status_changed' as any, {
      incidentId,
      newStatus,
      message,
    })
  }

  static async recordAuditLog(input: {
    companyId: string
    incidentId: string
    action: string
    unitIds: string[]
    decisionType: string
    dispatcherId?: string
    aiConfidence?: number
    aiReasoning?: string
    responseTime?: number
  }) {
    await prisma.emsDispatchLog.create({
      data: {
        incidentId: input.incidentId,
        action: input.action,
        dispatchedUnitIds: input.unitIds,
        decisionType: input.decisionType as any,
        dispatcherId: input.dispatcherId,
        aiConfidence: input.aiConfidence,
        aiReasoning: input.aiReasoning,
        responseTime: input.responseTime,
      },
    })
  }

  static async createInAppAlert(
    companyId: string,
    userId: string,
    title: string,
    message: string,
    type: string = 'ems_alert'
  ) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: userId, title, message, type }),
      })
    } catch {
      logger.warn('[EMS Notifications] In-app alert API unavailable')
    }
  }
}
