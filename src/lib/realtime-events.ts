export const REALTIME_EVENTS = [
  'task_created',
  'task_updated',
  'task_deleted',
  'task_submission_created',
  'comment_created',
  'comment_updated',
  'project_created',
  'project_updated',
  'project_deleted',
  'project_media_created',
  'room_created',
  'project_category_created',
  'employee_invited',
  'alert',
  'alert_read',
  'user_online',
  'user_offline',
  'presence_snapshot',
  'workspace_event',
] as const

export type RealtimeEventName = (typeof REALTIME_EVENTS)[number]

export type RealtimeWorkspaceEvent = {
  type: RealtimeEventName
  payload: unknown
  at: string
}
