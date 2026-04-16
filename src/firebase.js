import { getApp, getApps, initializeApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every(Boolean)
}

export function getFirebaseApp() {
  if (!hasFirebaseConfig()) {
    throw new Error('Missing Firebase client environment variables.')
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

export async function registerTaskitServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  if (!window.isSecureContext && window.location.hostname !== 'localhost') {
    console.warn('TASKIT PWA registration requires HTTPS outside localhost.')
    return null
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration('/')
  if (existingRegistration?.active?.scriptURL?.endsWith('/sw.js')) {
    return existingRegistration
  }

  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
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

  const supported = await isSupported().catch(() => false)
  if (!supported) {
    return null
  }

  return getMessaging(getFirebaseApp())
}

export async function getFcmToken() {
  const messaging = await getFirebaseMessagingInstance()
  if (!messaging) {
    return null
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    console.warn('Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY.')
    return null
  }

  const serviceWorkerRegistration = await registerTaskitServiceWorker()
  if (!serviceWorkerRegistration) {
    return null
  }

  return getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  })
}

export async function enablePushNotifications() {
  if (typeof window === 'undefined') {
    return { success: false, reason: 'server' }
  }

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    return { success: false, reason: permission }
  }

  const token = await getFcmToken()
  if (!token) {
    return { success: false, reason: 'missing-token' }
  }

  await fetch('/api/push/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  })

  console.log('TASKIT FCM token registered', token)
  return { success: true, token }
}

export async function subscribeToForegroundMessages(handler) {
  const messaging = await getFirebaseMessagingInstance()
  if (!messaging) {
    return () => {}
  }

  return onMessage(messaging, handler)
}
