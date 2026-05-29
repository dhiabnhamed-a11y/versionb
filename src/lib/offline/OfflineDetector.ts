import { STORAGE_KEY_MANUAL_OFFLINE } from './config'

type Listener = (isOnline: boolean) => void

class OfflineDetector {
  private listeners: Set<Listener> = new Set()
  private _isOnline: boolean
  private _isManualOffline: boolean

  constructor() {
    this._isManualOffline = localStorage.getItem(STORAGE_KEY_MANUAL_OFFLINE) === 'true'
    this._isOnline = this._isManualOffline ? false : navigator.onLine

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }
  }

  private handleOnline = () => {
    if (this._isManualOffline) return
    this._isOnline = true
    this.notifyAll()
  }

  private handleOffline = () => {
    if (this._isManualOffline) return
    this._isOnline = false
    this.notifyAll()
  }

  private notifyAll() {
    this.listeners.forEach((fn) => fn(this._isOnline))
  }

  get isOnline() {
    return this._isOnline && !this._isManualOffline
  }

  get isManualOffline() {
    return this._isManualOffline
  }

  enableOffline() {
    this._isManualOffline = true
    this._isOnline = false
    localStorage.setItem(STORAGE_KEY_MANUAL_OFFLINE, 'true')
    this.notifyAll()
  }

  disableOffline() {
    this._isManualOffline = false
    this._isOnline = navigator.onLine
    localStorage.removeItem(STORAGE_KEY_MANUAL_OFFLINE)
    this.notifyAll()
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  destroy() {
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    this.listeners.clear()
  }
}

export const offlineDetector = new OfflineDetector()
