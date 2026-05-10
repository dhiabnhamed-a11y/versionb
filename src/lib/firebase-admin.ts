import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging, type Message } from 'firebase-admin/messaging'

type FirebaseAdminConfig = {
  projectId: string
  clientEmail: string
  privateKey: string
}

function cleanEnvValue(value?: string) {
  return value?.trim()
}

function normalizePrivateKey(value?: string) {
  return cleanEnvValue(value)?.replace(/\\n/g, '\n')
}

function getServiceAccountProjectId(clientEmail?: string) {
  return clientEmail?.match(/@([^@]+)\.iam\.gserviceaccount\.com$/)?.[1] ?? null
}

function getAppSenderId(appId?: string) {
  return appId?.split(':')?.[1] ?? null
}

function getFirebaseAdminConfig() {
  const projectId = cleanEnvValue(process.env.FIREBASE_PROJECT_ID)
  const clientEmail = cleanEnvValue(process.env.FIREBASE_CLIENT_EMAIL)
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)

  if (!projectId || !clientEmail || !privateKey) {
    return null
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  } satisfies FirebaseAdminConfig
}

export function getFirebaseProjectDiagnostics() {
  const adminConfig = getFirebaseAdminConfig()
  const serviceAccountProjectId = getServiceAccountProjectId(adminConfig?.clientEmail)
  const clientProjectId = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) ?? null
  const clientSenderId = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) ?? null
  const appSenderId = getAppSenderId(cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID))
  const mismatches: string[] = []

  if (adminConfig?.projectId && clientProjectId && adminConfig.projectId !== clientProjectId) {
    mismatches.push('FIREBASE_PROJECT_ID does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  }

  if (adminConfig?.projectId && serviceAccountProjectId && adminConfig.projectId !== serviceAccountProjectId) {
    mismatches.push('FIREBASE_PROJECT_ID does not match FIREBASE_CLIENT_EMAIL project')
  }

  if (clientSenderId && appSenderId && clientSenderId !== appSenderId) {
    mismatches.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID does not match NEXT_PUBLIC_FIREBASE_APP_ID')
  }

  return {
    adminConfigured: Boolean(adminConfig),
    adminProjectId: adminConfig?.projectId ?? null,
    clientProjectId,
    clientSenderId,
    appSenderId,
    serviceAccountProjectId,
    mismatches,
  }
}

export function isFirebaseAdminConfigured() {
  return Boolean(getFirebaseAdminConfig())
}

function getFirebaseAdminApp() {
  const config = getFirebaseAdminConfig()
  if (!config) {
    throw new Error('Firebase admin credentials are not configured.')
  }

  return getApps()[0]
    ?? initializeApp({
      credential: cert(config),
      projectId: config.projectId,
    })
}

function getAppBaseUrl() {
  return cleanEnvValue(process.env.NEXT_PUBLIC_APP_URL)
    ?? cleanEnvValue(process.env.NEXTAUTH_URL)
    ?? 'http://localhost:3000'
}

function getAbsoluteUrl(url: string) {
  return new URL(url, getAppBaseUrl()).href
}

function toFcmData(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  )
}

function maskToken(token: string) {
  return token.length > 18 ? `${token.slice(0, 10)}...${token.slice(-8)}` : '[short-token]'
}

export function getFirebaseMessagingErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  return 'code' in error ? String((error as { code?: unknown }).code) : ''
}

function logFirebaseSendError(error: unknown, token: string) {
  const code = getFirebaseMessagingErrorCode(error)
  const diagnostic = getFirebaseProjectDiagnostics()
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message)
    : 'Unknown Firebase Messaging error'

  if (
    code === 'messaging/mismatched-credential'
    || code === 'messaging/registration-token-not-registered'
    || code === 'messaging/invalid-registration-token'
  ) {
    console.error('[fcm] Token send failed.', {
      code,
      message,
      token: maskToken(token),
      firebaseProject: diagnostic,
    })
    return
  }

  console.error('[fcm] Token send failed with an unexpected error.', {
    code,
    message,
    token: maskToken(token),
  })
}

export async function sendNotification(
  userToken: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  if (!userToken) {
    return null
  }

  const messaging = getMessaging(getFirebaseAdminApp())
  const relativeUrl = data.url ?? '/dashboard/employee/alerts'
  const absoluteUrl = getAbsoluteUrl(relativeUrl)
  const icon = data.icon ?? '/icons/taskit-192.png'
  const badge = data.badge ?? '/favicon.ico'
  const tag = data.tag ?? data.alertId ?? 'taskit-alert'
  const message: Message = {
    token: userToken,
    notification: {
      title,
      body,
    },
    data: toFcmData({
      title,
      body,
      icon,
      badge,
      url: relativeUrl,
      sound: '/sounds/taskitnot.m4a',
      tag,
      ...data,
    }),
    webpush: {
      headers: {
        Urgency: 'high',
        TTL: '86400',
      },
      notification: {
        title,
        body,
        icon,
        badge,
        tag,
        silent: false,
        requireInteraction: false,
        data: {
          url: relativeUrl,
        },
      },
      fcmOptions: {
        link: absoluteUrl,
      },
    },
    android: {
      priority: 'high',
      notification: {
        title,
        body,
        icon: 'ic_notification',
        channelId: 'taskit-alerts',
        clickAction: 'OPEN_TASKIT_ALERTS',
        defaultSound: true,
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
      },
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: 'default',
        },
      },
    },
  }

  try {
    return await messaging.send(message)
  } catch (error) {
    logFirebaseSendError(error, userToken)
    throw error
  }
}

export function isInvalidFirebaseTokenError(error: unknown) {
  const code = getFirebaseMessagingErrorCode(error)
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token'
}

export function isFirebaseProjectMismatchError(error: unknown) {
  return getFirebaseMessagingErrorCode(error) === 'messaging/mismatched-credential'
}
