import { prisma } from '@/lib/db'
import { sendNotification } from '@/lib/firebase-admin'
import { emitEmsEvent } from './ems-realtime'
import { logger } from '@/modules/shared/logger'

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

          for (const token of pushTokens) {
            try {
              await sendNotification(
                token.token,
                title,
                message,
                {
                  type: 'ems_dispatch',
                  incidentId,
                  incidentNumber,
                  severity,
                  unitId,
                  url: `/dashboard/admin/ems/dispatch`,
                  tag: `ems-dispatch-${incidentId}`,
                }
              )
            } catch (pushErr) {
              logger.warn(`[EMS Notifications] Push failed for token ${token.id.slice(0, 8)}...`, { error: pushErr })
            }
          }
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
