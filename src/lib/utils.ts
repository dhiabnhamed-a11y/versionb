import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTimeAgo(date: Date | string) {
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function getStageProgress(stage: string): number {
  const map: Record<string, number> = {
    TODO: 0,
    IN_PROGRESS: 40,
    REVIEW: 75,
    DONE: 100,
  }
  return map[stage] ?? 0
}

export function getPriorityColor(priority: string) {
  const map: Record<string, string> = {
    LOW: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    MEDIUM: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    HIGH: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    CRITICAL: 'text-red-400 bg-red-400/10 border-red-400/20',
  }
  return map[priority] ?? map.MEDIUM
}

export function getAlertIcon(type: string) {
  const map: Record<string, string> = {
    URGENT_TASK: '🚨',
    DEADLINE_WARNING: '⏰',
    MANAGER_CALL: '📞',
  }
  return map[type] ?? '🔔'
}
