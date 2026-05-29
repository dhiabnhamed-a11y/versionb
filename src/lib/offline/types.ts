export interface OfflineQueueItem {
  id: string
  type: string
  payload: unknown
  timestamp: number
  retryCount: number
  lastError?: string
}

export type OfflineStatus = 'online' | 'offline' | 'manual-offline' | 'expired'

export type WarningLevel = 'amber' | 'red' | 'none'

export interface OfflineTimerState {
  remaining: number
  warningLevel: WarningLevel
  progress: number
}

export interface OfflineToastState {
  id: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  dismissible: boolean
  action?: { label: string; onClick: () => void }
}

export interface SyncProgress {
  synced: number
  total: number
  failed: number
}

export interface OfflineContextValue {
  status: OfflineStatus
  timer: OfflineTimerState
  queueLength: number
  isSyncing: boolean
  syncProgress: SyncProgress | null
  showWarningModal: boolean
  showExpiredOverlay: boolean
  enableOffline: () => void
  disableOffline: () => void
  connectNow: () => void
  dismissToast: (id: string) => void
  dismissWarningModal: (remindLater?: boolean) => void
  addToQueue: (type: string, payload: unknown) => Promise<void>
}
