'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { offlineDetector } from './OfflineDetector'
import { offlineQueue } from './OfflineQueue'
import { timerService } from './TimerService'
import { syncService } from './SyncService'
import { STORAGE_KEY_SESSION, OFFLINE_SESSION_DURATION_MS } from './config'
import type { OfflineContextValue, OfflineStatus, OfflineTimerState, OfflineToastState } from './types'
import OfflineBanner from '@/components/offline/OfflineBanner'
import OfflineToast from '@/components/offline/OfflineToast'
import OfflineWarningModal from '@/components/offline/OfflineWarningModal'
import OfflineBlockingOverlay from '@/components/offline/OfflineBlockingOverlay'

const Context = createContext<OfflineContextValue | null>(null)

export function useOffline() {
  const value = useContext(Context)
  if (!value) throw new Error('useOffline must be used inside OfflineProvider')
  return value
}

function getInitialState(): { status: OfflineStatus; showExpired: boolean } {
  try {
    const storedSession = localStorage.getItem(STORAGE_KEY_SESSION)
    if (storedSession) {
      const elapsed = Date.now() - Number(storedSession)
      if (elapsed >= OFFLINE_SESSION_DURATION_MS) {
        localStorage.removeItem(STORAGE_KEY_SESSION)
        return { status: 'expired', showExpired: true }
      }
      return { status: offlineDetector.isManualOffline ? 'manual-offline' : 'offline', showExpired: false }
    }
  } catch {
    // localStorage not available (SSR)
  }
  return { status: 'online', showExpired: false }
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState(getInitialState)
  const [status, setStatus] = useState<OfflineStatus>(initial.status)
  const [showExpiredOverlay, setShowExpiredOverlay] = useState(initial.showExpired)
  const [timer, setTimer] = useState<OfflineTimerState>({ remaining: 0, warningLevel: 'none', progress: 0 })
  const [queueLength, setQueueLength] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ synced: number; total: number; failed: number } | null>(null)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [toasts, setToasts] = useState<OfflineToastState[]>([])

  const redShownRef = useRef(false)
  const expiredShownRef = useRef(false)
  const statusRef = useRef(status)
  const queueLengthRef = useRef(queueLength)

  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => { queueLengthRef.current = queueLength }, [queueLength])

  const addToast = useCallback((toast: Omit<OfflineToastState, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const refreshQueueLength = useCallback(async () => {
    const len = await offlineQueue.count()
    setQueueLength(len)
  }, [])

  const enableOffline = useCallback(() => {
    offlineDetector.enableOffline()
    const startTime = Date.now()
    localStorage.setItem(STORAGE_KEY_SESSION, String(startTime))
    timerService.start(startTime)
    setStatus('manual-offline')
    redShownRef.current = false
    expiredShownRef.current = false
    addToast({
      message: "You're working offline. Your data is saved locally for up to 5 hours. Connect before time runs out to keep your work.",
      type: 'info',
      dismissible: true,
    })
    refreshQueueLength()
  }, [addToast, refreshQueueLength])

  const disableOffline = useCallback(() => {
    offlineDetector.disableOffline()
    localStorage.removeItem(STORAGE_KEY_SESSION)
    timerService.stop()
    setStatus('online')
    setShowWarningModal(false)
    setShowExpiredOverlay(false)
  }, [])

  const connectNow = useCallback(() => {
    const currentStatus = statusRef.current
    if (currentStatus === 'offline' || currentStatus === 'manual-offline' || currentStatus === 'expired') {
      disableOffline()
      if (navigator.onLine) {
        setIsSyncing(true)
        syncService.syncAll().finally(() => {
          setIsSyncing(false)
          refreshQueueLength()
        })
      }
    }
  }, [disableOffline, refreshQueueLength])

  const dismissWarningModal = useCallback((remindLater?: boolean) => {
    setShowWarningModal(false)
    if (remindLater) {
      setTimeout(() => {
        setShowWarningModal(true)
      }, 30 * 60 * 1000)
    }
  }, [])

  const addToQueue = useCallback(async (type: string, payload: unknown) => {
    if (statusRef.current === 'online') return
    await offlineQueue.enqueue(type, payload)
    await refreshQueueLength()
  }, [refreshQueueLength])

  useEffect(() => {
    const unsubDetector = offlineDetector.subscribe((isOnline) => {
      const currentStatus = statusRef.current
      if (isOnline && (currentStatus === 'offline' || currentStatus === 'manual-offline')) {
        localStorage.removeItem(STORAGE_KEY_SESSION)
        timerService.stop()
        setStatus('online')
        setShowExpiredOverlay(false)
        setShowWarningModal(false)
        setIsSyncing(true)
        syncService.syncAll().finally(() => {
          setIsSyncing(false)
          refreshQueueLength()
        })
      } else if (!isOnline && currentStatus === 'online') {
        const startTime = Date.now()
        localStorage.setItem(STORAGE_KEY_SESSION, String(startTime))
        timerService.start(startTime)
        setStatus('offline')
        redShownRef.current = false
        expiredShownRef.current = false
        addToast({
          message: "You're working offline. Your data is saved locally for up to 5 hours. Connect before time runs out to keep your work.",
          type: 'info',
          dismissible: true,
        })
      }
    })

    return () => { unsubDetector() }
  }, [addToast, refreshQueueLength])

  useEffect(() => {
    const unsubTimer = timerService.subscribe((state) => {
      setTimer(state)

      if (state.warningLevel === 'red' && !redShownRef.current) {
        redShownRef.current = true
        if (state.remaining > 0) {
          setShowWarningModal(true)
        }
      }

      if (state.remaining <= 0 && !expiredShownRef.current) {
        expiredShownRef.current = true
        setShowExpiredOverlay(true)
        setStatus('expired')
      }
    })

    return () => { unsubTimer() }
  }, [])

  useEffect(() => {
    const unsubSync = syncService.subscribe((event) => {
      if (event.type === 'progress') {
        setSyncProgress({ synced: event.synced, total: event.total, failed: event.failed })
      } else if (event.type === 'complete') {
        setSyncProgress(null)
        setIsSyncing(false)
        addToast({ message: 'All changes saved!', type: 'success', dismissible: true })
        refreshQueueLength()
      } else if (event.type === 'partial') {
        setSyncProgress(null)
        setIsSyncing(false)
        addToast({
          message: 'Some changes could not be saved.',
          type: 'warning',
          dismissible: true,
          action: { label: 'Retry', onClick: () => syncService.retryFailed() },
        })
        refreshQueueLength()
      } else if (event.type === 'error') {
        setIsSyncing(false)
        addToast({
          message: 'Connection lost during sync. Will retry automatically.',
          type: 'error',
          dismissible: true,
        })
      }
    })

    return () => { unsubSync() }
  }, [addToast, refreshQueueLength])

  useEffect(() => {
    const storedSession = localStorage.getItem(STORAGE_KEY_SESSION)
    if (storedSession) {
      const startTime = Number(storedSession)
      const elapsed = Date.now() - startTime
      if (elapsed < OFFLINE_SESSION_DURATION_MS) {
        timerService.start(startTime)
      } else {
        localStorage.removeItem(STORAGE_KEY_SESSION)
        expiredShownRef.current = true
      }
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (queueLengthRef.current > 0 && (statusRef.current === 'offline' || statusRef.current === 'manual-offline')) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    Promise.resolve().then(() => { refreshQueueLength() })
  }, [refreshQueueLength])

  useEffect(() => {
    const isNetworkError = (reason: unknown): boolean => {
      if (reason instanceof TypeError) {
        const msg = reason.message.toLowerCase()
        return msg.includes('fetch') || msg.includes('network') || msg.includes('load failed')
      }
      if (reason instanceof DOMException && reason.name === 'AbortError') return true
      return false
    }

    const handleRejection = (e: PromiseRejectionEvent) => {
      if (isNetworkError(e.reason)) {
        e.preventDefault()
        e.stopPropagation()
        const currentStatus = statusRef.current
        if (currentStatus === 'online' && !navigator.onLine) {
          const startTime = Date.now()
          localStorage.setItem(STORAGE_KEY_SESSION, String(startTime))
          timerService.start(startTime)
          setStatus('offline')
          redShownRef.current = false
          expiredShownRef.current = false
        }
      }
    }

    const handleError = (e: ErrorEvent) => {
      const currentStatus = statusRef.current
      if (currentStatus !== 'online' && isNetworkError(e.error || e.message)) {
        e.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', handleRejection)
    window.addEventListener('error', handleError)
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])

  const isOffline = status !== 'online'

  return (
    <Context.Provider
      value={{
        status,
        timer,
        queueLength,
        isSyncing,
        syncProgress,
        showWarningModal,
        showExpiredOverlay,
        enableOffline,
        disableOffline,
        connectNow,
        dismissToast,
        dismissWarningModal,
        addToQueue,
      }}
    >
      {children}
      {isOffline && <OfflineBanner />}
      <OfflineToast toasts={toasts} onDismiss={dismissToast} />
      {showWarningModal && <OfflineWarningModal />}
      {showExpiredOverlay && <OfflineBlockingOverlay />}
    </Context.Provider>
  )
}
