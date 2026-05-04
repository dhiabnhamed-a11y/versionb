import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

function getFirebaseAdminConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    return null
  }

  return {
    projectId,
    clientEmail,
    privateKey,
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

  return messaging.send({
    token: userToken,
    data: {
      title,
      body,
      icon: data.icon ?? '/icons/taskit-192.png',
      badge: data.badge ?? '/favicon.ico',
      url: data.url ?? '/dashboard/employee/alerts',
      tag: data.tag ?? data.alertId ?? 'taskit-alert',
      ...data,
    },
    webpush: {
      headers: {
        Urgency: 'high',
        TTL: '86400',
      },
      fcmOptions: {
        link: data.url ?? '/dashboard/employee/alerts',
      },
    },
  })
}

export function isInvalidFirebaseTokenError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: unknown }).code) : ''
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token'
}
