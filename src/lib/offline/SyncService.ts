import { offlineQueue } from './OfflineQueue'
import { MAX_QUEUE_RETRIES, STORAGE_KEY_SESSION, STORAGE_KEY_MANUAL_OFFLINE } from './config'
import { offlineDetector } from './OfflineDetector'

type SyncCallback = (event: SyncEvent) => void

interface SyncEvent {
  type: 'progress' | 'complete' | 'error' | 'partial'
  synced: number
  total: number
  failed: number
  error?: string
}

class SyncService {
  private callbacks: Set<SyncCallback> = new Set()
  private _isSyncing = false
  private _progress: { synced: number; total: number; failed: number } | null = null

  get isSyncing() {
    return this._isSyncing
  }

  get progress() {
    return this._progress
  }

  subscribe(fn: SyncCallback) {
    this.callbacks.add(fn)
    return () => this.callbacks.delete(fn)
  }

  private notify(event: SyncEvent) {
    this.callbacks.forEach((fn) => fn(event))
  }

  async syncAll() {
    if (this._isSyncing) return
    if (!offlineDetector.isOnline) return

    this._isSyncing = true
    const items = await offlineQueue.getPending()
    this._progress = { synced: 0, total: items.length, failed: 0 }

    if (items.length === 0) {
      this._isSyncing = false
      this._progress = null
      this.cleanupSession()
      return
    }

    this.notify({ type: 'progress', ...this._progress })

    for (const item of items) {
      if (!offlineDetector.isOnline) {
        this._isSyncing = false
        this.notify({ type: 'error', ...this._progress!, error: 'Connection lost during sync' })
        return
      }

      try {
        const res = await fetch(item.type, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        })

        if (res.ok) {
          await offlineQueue.remove(item.id)
          this._progress.synced++
        } else {
          await offlineQueue.incrementRetry(item.id, `HTTP ${res.status}`)
          this._progress.failed++
        }
      } catch {
        if (item.retryCount >= MAX_QUEUE_RETRIES) {
          this._progress.failed++
        } else {
          await offlineQueue.incrementRetry(item.id, 'Network error')
          this._progress.failed++
        }
      }

      this.notify({ type: 'progress', ...this._progress })
    }

    const remaining = await offlineQueue.count()
    if (remaining === 0) {
      this._isSyncing = false
      this.notify({ type: 'complete', synced: this._progress?.synced ?? 0, total: items.length, failed: 0 })
      this.cleanupSession()
      this._progress = null
    } else {
      this._isSyncing = false
      this.notify({ type: 'partial', ...this._progress! })
    }
  }

  private cleanupSession() {
    localStorage.removeItem(STORAGE_KEY_SESSION)
    localStorage.removeItem(STORAGE_KEY_MANUAL_OFFLINE)
  }

  async retryFailed() {
    if (!offlineDetector.isOnline) return
    const failed = await offlineQueue.getFailed()
    if (failed.length === 0) return

    this._isSyncing = true
    this._progress = { synced: 0, total: failed.length, failed: 0 }

    for (const item of failed) {
      if (!offlineDetector.isOnline) {
        this._isSyncing = false
        return
      }

      try {
        const res = await fetch(item.type, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        })

        if (res.ok) {
          await offlineQueue.remove(item.id)
          this._progress.synced++
        }
      } catch {
        this._progress.failed++
      }
    }

    this._isSyncing = false
  }
}

export const syncService = new SyncService()
