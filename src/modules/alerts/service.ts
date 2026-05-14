import {
  getFirebaseMessagingErrorCode,
  isFirebaseAdminConfigured,
  isFirebaseProjectMismatchError,
  isInvalidFirebaseTokenError,
  sendNotification,
} from '@/lib/firebase-admin'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { emitUserRealtime } from '@/lib/realtime-server'
import { normalizeUserRole } from '@/lib/security'
import { logger } from '@/modules/shared/logger'
import { forbidden } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'
import {
  createAlertRecord,
  deletePushTokensForUser,
  listAlertsForRecipient,
  listPushTokensForUser,
  markAlertReadForRecipient,
} from '@/modules/alerts/repository'
import {
  createAlertSchema,
  markAlertReadSchema,
  type CreateAlertInput,
  type MarkAlertReadInput,
} from '@/modules/alerts/validation'

type PushAlert = {
  id: string
  message: string
  title: string
  type: string
}

function assertCanSendAlerts(user: SessionUser) {
  if (normalizeUserRole(user.role) === 'EMPLOYEE') throw forbidden()
}

async function listRecipientPushTokens(recipientId: string) {
  try {
    return await listPushTokensForUser(recipientId)
  } catch (error) {
    if (!isMissingDatabaseObjectError(error)) throw error
    logger.warn('alerts.push_token_storage_missing', { recipientId })
    return []
  }
}

async function mirrorAlertToPush(recipientId: string, alert: PushAlert) {
  if (!isFirebaseAdminConfigured()) return

  const recipientTokens = await listRecipientPushTokens(recipientId)
  const results = await Promise.allSettled(
    recipientTokens.map(({ token }) =>
      sendNotification(token, `TASKIT: ${alert.title}`, alert.message, {
        alertId: alert.id,
        type: alert.type,
        url: '/dashboard/employee/alerts',
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
    logger.error('alerts.fcm_mirror_failed', undefined, {
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

  await deletePushTokensForUser(recipientId, invalidTokens)
}

export async function listCurrentUserAlerts(user: SessionUser) {
  try {
    return await listAlertsForRecipient(user.id)
  } catch (error) {
    if (!isMissingDatabaseObjectError(error)) throw error
    logger.warn('alerts.storage_missing', { userId: user.id })
    return []
  }
}

export async function createUserAlert(user: SessionUser, rawInput: unknown) {
  assertCanSendAlerts(user)
  const input: CreateAlertInput = createAlertSchema.parse(rawInput)
  const alert = await createAlertRecord({
    message: input.message,
    recipientId: input.recipientId,
    senderId: user.id,
    title: input.title,
    type: input.type,
  })

  emitUserRealtime(input.recipientId, 'alert', {
    id: alert.id,
    type: alert.type,
    title: alert.title,
    message: alert.message,
    read: alert.read,
    sender: alert.sender,
    createdAt: alert.createdAt,
  })

  await mirrorAlertToPush(input.recipientId, alert)

  return alert
}

export async function markCurrentUserAlertRead(user: SessionUser, rawInput: unknown) {
  const input: MarkAlertReadInput = markAlertReadSchema.parse(rawInput)
  const alert = await markAlertReadForRecipient({ alertId: input.alertId, recipientId: user.id })
  emitUserRealtime(user.id, 'alert_read', { alertId: alert.id })
  return alert
}
