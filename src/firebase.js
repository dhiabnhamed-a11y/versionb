const TASKIT_SW_PATH = '/firebase-messaging-sw.js'
const TASKIT_SW_SCOPE = '/'
const TOKEN_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 12
let firebaseAppModulePromise = null
let firebaseMessagingModulePromise = null

function cleanEnvValue(value) {
  return typeof value === 'string' ? value.trim() : value
}

function cleanWebPushKey(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, '') : value
}

const firebaseConfig = {
  apiKey: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
}

function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every(Boolean)
}

function isLocalhost() {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
}

function loadFirebaseAppModule() {
  firebaseAppModulePromise ??= import('firebase/app')
  return firebaseAppModulePromise
}

function loadFirebaseMessagingModule() {
  firebaseMessagingModulePromise ??= import('firebase/messaging')
  return firebaseMessagingModulePromise
}

function getMissingFirebaseConfigKeys() {
  return Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key)
}

function getStoredToken() {
  try {
    return localStorage.getItem('taskit-fcm-token')
  } catch {
    return null
  }
}

function setStoredToken(token) {
  try {
    localStorage.setItem('taskit-fcm-token', token)
    localStorage.setItem('taskit-fcm-token-synced-at', String(Date.now()))
  } catch {
    // Private browsing modes may block localStorage. Token storage on the server still succeeds.
  }
}

async function waitForServiceWorkerActivation(registration) {
  if (registration.active) {
    return registration
  }

  const worker = registration.installing || registration.waiting
  if (!worker) {
    return navigator.serviceWorker.ready
  }

  await new Promise((resolve) => {
    if (worker.state === 'activated') {
      resolve()
      return
    }

    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') {
        resolve()
      }
    })
  })

  return navigator.serviceWorker.ready
}

export function getFirebaseClientDiagnostics() {
  const appSenderId = firebaseConfig.appId?.split(':')?.[1] ?? null
  return {
    configured: hasFirebaseConfig(),
    missingConfigKeys: getMissingFirebaseConfigKeys(),
    projectId: firebaseConfig.projectId ?? null,
    messagingSenderId: firebaseConfig.messagingSenderId ?? null,
    appSenderId,
    senderIdMatchesAppId: Boolean(firebaseConfig.messagingSenderId && appSenderId && firebaseConfig.messagingSenderId === appSenderId),
    hasVapidKey: Boolean(cleanWebPushKey(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY)),
    serviceWorkerPath: TASKIT_SW_PATH,
    secureContext: typeof window !== 'undefined' ? window.isSecureContext : null,
    notificationPermission: typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  }
}

export async function getFirebaseApp() {
  if (!hasFirebaseConfig()) {
    throw new Error(`Missing Firebase client environment variables: ${getMissingFirebaseConfigKeys().join(', ')}`)
  }

  const { getApp, getApps, initializeApp } = await loadFirebaseAppModule()
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

export async function registerTaskitServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  if (!window.isSecureContext && !isLocalhost()) {
    console.warn('TASKIT PWA registration requires HTTPS outside localhost.')
    return null
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration(TASKIT_SW_SCOPE)
  if (existingRegistration?.active?.scriptURL?.endsWith(TASKIT_SW_PATH)) {
    void existingRegistration.update().catch(() => undefined)
    return waitForServiceWorkerActivation(existingRegistration)
  }

  const registration = await navigator.serviceWorker.register(TASKIT_SW_PATH, { scope: TASKIT_SW_SCOPE })
  return waitForServiceWorkerActivation(registration)
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    return 'denied'
  }

  return Notification.requestPermission()
}

async function getFirebaseMessagingInstance() {
  if (typeof window === 'undefined' || !hasFirebaseConfig()) {
    return null
  }

  const { getMessaging, isSupported } = await loadFirebaseMessagingModule()
  const supported = await isSupported().catch(() => false)
  if (!supported) {
    return null
  }

  return getMessaging(await getFirebaseApp())
}

export async function getFcmToken() {
  try {
    const messaging = await getFirebaseMessagingInstance()
    if (!messaging) {
      return null
    }

    const vapidKey = cleanWebPushKey(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY)
    if (!vapidKey) {
      console.warn('Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY.')
      return null
    }

    const serviceWorkerRegistration = await registerTaskitServiceWorker()
    if (!serviceWorkerRegistration) {
      return null
    }

    const { getToken } = await loadFirebaseMessagingModule()
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    })

    return token || null
  } catch (error) {
    console.error('[push] Failed to generate FCM token.', {
      error,
      diagnostics: getFirebaseClientDiagnostics(),
    })
    return null
  }
}

async function persistFcmToken(token) {
  const previousToken = getStoredToken()
  const response = await fetch('/api/push/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
      previousToken: previousToken && previousToken !== token ? previousToken : undefined,
      client: getFirebaseClientDiagnostics(),
    }),
  })

  const body = await response.json().catch(() => null)
  if (!response.ok || body?.ok === false) {
    console.error('[push] FCM token storage failed.', { status: response.status, body })
    return { success: false, reason: body?.reason || body?.error || 'token-register-failed' }
  }

  setStoredToken(token)
  return { success: true, token }
}

export async function syncGrantedPushToken() {
  if (typeof window === 'undefined') {
    return { success: false, reason: 'server' }
  }

  if (!('Notification' in window)) {
    return { success: false, reason: 'unsupported' }
  }

  if (Notification.permission !== 'granted') {
    return { success: false, reason: Notification.permission }
  }

  const token = await getFcmToken()
  if (!token) {
    return { success: false, reason: 'missing-token' }
  }

  return persistFcmToken(token)
}

export async function enablePushNotifications() {
  if (typeof window === 'undefined') {
    return { success: false, reason: 'server' }
  }

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    return { success: false, reason: permission }
  }

  return syncGrantedPushToken()
}

export async function refreshPushTokenIfNeeded() {
  if (typeof window === 'undefined') {
    return { success: false, reason: 'server' }
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return { success: false, reason: 'permission-not-granted' }
  }

  const syncedAt = Number(localStorage.getItem('taskit-fcm-token-synced-at') || 0)
  if (Date.now() - syncedAt < TOKEN_REFRESH_INTERVAL_MS) {
    return { success: true, reason: 'fresh' }
  }

  return syncGrantedPushToken()
}

export function extractTaskitNotification(payload) {
  const data = payload?.data ?? {}
  const notification = payload?.notification ?? {}

  return {
    title: data.title || notification.title || 'TASKIT',
    body: data.body || notification.body || 'You have a new notification.',
    icon: data.icon || notification.icon || '/icons/taskit-192.png',
    badge: data.badge || '/favicon.ico',
    url: data.url || notification.click_action || '/dashboard',
    tag: data.tag || data.alertId || 'taskit-alert',
  }
}

export async function subscribeToForegroundMessages(handler) {
  const messaging = await getFirebaseMessagingInstance()
  if (!messaging) {
    return () => {}
  }

  const { onMessage } = await loadFirebaseMessagingModule()
  return onMessage(messaging, handler)
}
