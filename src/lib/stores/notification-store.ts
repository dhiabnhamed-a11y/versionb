import { create } from 'zustand'
import type { NotificationCreatedPayload } from '@/lib/realtime-event-payloads'

export type AppNotification = NotificationCreatedPayload & {
  read: boolean
}

type NotificationState = {
  notifications: AppNotification[]
  unreadCount: number
}

type NotificationActions = {
  /**
   * Add a new notification received from the realtime system.
   * Duplicate IDs are ignored.
   */
  add: (notification: NotificationCreatedPayload) => void
  /** Mark a single notification as read by ID. */
  markRead: (id: string) => void
  /** Mark all notifications as read. */
  markAllRead: () => void
  /** Remove a single notification by ID. */
  dismiss: (id: string) => void
  /** Remove all notifications. */
  clear: () => void
}

export type NotificationStore = NotificationState & NotificationActions

const MAX_NOTIFICATIONS = 200

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,

  add(notification) {
    set((state) => {
      if (state.notifications.some((n) => n.id === notification.id)) return state
      const next: AppNotification = { ...notification, read: false }
      const notifications = [next, ...state.notifications].slice(0, MAX_NOTIFICATIONS)
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length }
    })
  },

  markRead(id) {
    set((state) => {
      const notifications = state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length }
    })
  },

  markAllRead() {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },

  dismiss(id) {
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id)
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length }
    })
  },

  clear() {
    set({ notifications: [], unreadCount: 0 })
  },
}))
