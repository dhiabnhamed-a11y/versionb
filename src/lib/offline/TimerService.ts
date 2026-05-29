import { OFFLINE_SESSION_DURATION_MS, WARN_AMBER_MS, WARN_RED_MS } from './config'
import type { OfflineTimerState, WarningLevel } from './types'

type TimerCallback = (state: OfflineTimerState) => void

class TimerService {
  private startedAt: number | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private callbacks: Set<TimerCallback> = new Set()
  private _warningLevel: WarningLevel = 'none'

  get remaining() {
    if (!this.startedAt) return 0
    return Math.max(0, OFFLINE_SESSION_DURATION_MS - (Date.now() - this.startedAt))
  }

  get progress() {
    if (!this.startedAt) return 1
    return 1 - this.remaining / OFFLINE_SESSION_DURATION_MS
  }

  get warningLevel() {
    return this._warningLevel
  }

  get isExpired() {
    return this.remaining <= 0 && this.startedAt !== null
  }

  static warningLevelFor(remaining: number): WarningLevel {
    if (remaining <= 0) return 'red'
    if (remaining <= WARN_RED_MS) return 'red'
    if (remaining <= WARN_AMBER_MS) return 'amber'
    return 'none'
  }

  start(startTime?: number) {
    this.startedAt = startTime ?? Date.now()
    this.tick()
    this.intervalId = setInterval(() => this.tick(), 1000)
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId)
    this.intervalId = null
    this.startedAt = null
    this._warningLevel = 'none'
  }

  private tick() {
    const remaining = this.remaining
    this._warningLevel = TimerService.warningLevelFor(remaining)
    this.callbacks.forEach((fn) =>
      fn({
        remaining,
        warningLevel: this._warningLevel,
        progress: this.progress,
      })
    )
  }

  subscribe(fn: TimerCallback) {
    this.callbacks.add(fn)
    if (this.startedAt !== null) {
      fn({
        remaining: this.remaining,
        warningLevel: this._warningLevel,
        progress: this.progress,
      })
    }
    return () => this.callbacks.delete(fn)
  }

  get startedAtValue() {
    return this.startedAt
  }
}

export const timerService = new TimerService()
