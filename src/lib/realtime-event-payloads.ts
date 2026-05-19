/**
 * Typed payload interfaces for every canonical realtime event.
 * All fields mirror what the server emits inside `RealtimeEnvelope.payload`.
 */

export interface TaskCreatedPayload {
  id: string
  title: string
  projectId: string
  companyId: string
  stage: string
  assigneeId?: string | null
  createdAt: string
}

export interface TaskUpdatedPayload {
  id: string
  title?: string
  stage?: string
  progress?: number
  assigneeId?: string | null
  updatedAt: string
  realtimePatch?: RealtimeEntityPatch
}

export interface TaskDeletedPayload {
  id: string
  projectId: string
}

export interface TaskSubmissionCreatedPayload {
  id: string
  taskId: string
  submittedById: string
  status: string
  createdAt: string
}

export interface CommentCreatedPayload {
  id: string
  body: string
  authorId: string
  taskId?: string | null
  projectId?: string | null
  createdAt: string
}

export interface CommentUpdatedPayload {
  id: string
  body: string
  updatedAt: string
}

export interface ProjectCreatedPayload {
  id: string
  name: string
  companyId: string
  createdAt: string
}

export interface ProjectUpdatedPayload {
  id: string
  name?: string
  status?: string
  updatedAt: string
}

export interface ProjectDeletedPayload {
  id: string
}

export interface ProjectMediaCreatedPayload {
  id: string
  projectId: string
  url: string
  mimeType?: string | null
  createdAt: string
}

export interface RoomCreatedPayload {
  id: string
  name: string
  companyId: string
  createdAt: string
}

export interface ProjectCategoryCreatedPayload {
  id: string
  name: string
  companyId: string
}

export interface ClientCreatedPayload {
  id: string
  name: string
  companyId: string
  createdAt: string
}

export interface ClientUpdatedPayload {
  id: string
  name?: string
  updatedAt: string
}

export interface ClientDeletedPayload {
  id: string
}

export interface InvoiceCreatedPayload {
  id: string
  number?: string | null
  companyId: string
  clientId?: string | null
  totalAmount: number
  currency: string
  status: string
  createdAt: string
}

export interface InvoiceUpdatedPayload {
  id: string
  status?: string
  updatedAt: string
}

export interface InvoiceDeletedPayload {
  id: string
}

export interface InvoicePaidPayload {
  id: string
  paidAt: string
  amount: number
  currency: string
}

export interface EmployeeInvitedPayload {
  inviteId: string
  email: string
  role: string
  companyId: string
  invitedById: string
  createdAt: string
}

export interface NotificationCreatedPayload {
  id: string
  title: string
  body?: string | null
  category?: string | null
  link?: string | null
  userId?: string | null
  companyId?: string | null
  createdAt: string
}

export interface NotificationReadPayload {
  notificationId: string
  userId: string
  readAt: string
}

export interface PresenceUserOnlinePayload {
  userId: string
  name: string | null
  role: string | null
  companyId: string | null
  online: true
  at: string
}

export interface PresenceUserOfflinePayload {
  userId: string
  name: string | null
  role: string | null
  companyId: string | null
  online: false
  at: string
}

export interface PresenceSnapshotPayload {
  users: Array<{
    userId: string
    name: string | null
    role: string | null
    online: boolean
    activeChannelId: string | null
    deviceCount: number
    lastSeenAt: string
  }>
}

export interface WorkspaceEventPayload {
  type: string
  payload: unknown
  at: string
}

export interface SocialAccountConnectedPayload {
  accountId: string
  platform: string
  userId: string
}

export interface SocialAccountDisconnectedPayload {
  accountId: string
  platform: string
}

export interface SocialSyncCompletedPayload {
  syncJobId: string
  accountId: string
  platform: string
  completedAt: string
  postsCount?: number
}

export interface SocialMetricsUpdatedPayload {
  accountId: string
  platform: string
  snapshotAt: string
}

export interface SocialInsightCreatedPayload {
  insightId: string
  accountId: string
  platform: string
  type: string
}

export interface SocialWebhookProcessedPayload {
  webhookId: string
  platform: string
  event: string
  processedAt: string
}

export interface AiRunCompletedPayload {
  runId: string
  agentId: string
  status: 'success' | 'error'
  completedAt: string
}

export interface TeamMemberAssignedPayload {
  teamId: string
  userId: string
  role: string
  assignedAt: string
}

export interface AssetUpdatedPayload {
  assetId: string
  status?: string
  updatedAt: string
}

export interface IncidentCreatedPayload {
  id: string
  title: string
  severity: string
  departmentId?: string | null
  createdAt: string
}

export interface IncidentUpdatedPayload {
  id: string
  status?: string
  severity?: string
  updatedAt: string
}

export interface ApprovalCompletedPayload {
  approvalId: string
  decision: 'approved' | 'rejected'
  decidedById: string
  decidedAt: string
}

export interface FinanceInvoicePaidPayload {
  invoiceId: string
  amount: number
  currency: string
  paidAt: string
}

/** Inline type from delta.ts — duplicated here to keep this file self-contained. */
export interface RealtimeEntityPatch {
  entityType: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  changed: Record<string, unknown>
  removed: string[]
  version: number
  eventId: string
  occurredAt: string
}

/**
 * Map from canonical event name to its payload interface.
 * Use this for type-safe event handling:
 * @example
 *   function handle<K extends RealtimeEventName>(name: K, payload: RealtimeEventPayloadMap[K]) {}
 */
export interface RealtimeEventPayloadMap {
  'task.created': TaskCreatedPayload
  'task.updated': TaskUpdatedPayload
  'task.deleted': TaskDeletedPayload
  'task.submission.created': TaskSubmissionCreatedPayload
  'comment.created': CommentCreatedPayload
  'comment.updated': CommentUpdatedPayload
  'project.created': ProjectCreatedPayload
  'project.updated': ProjectUpdatedPayload
  'project.deleted': ProjectDeletedPayload
  'project.media.created': ProjectMediaCreatedPayload
  'room.created': RoomCreatedPayload
  'project.category.created': ProjectCategoryCreatedPayload
  'client.created': ClientCreatedPayload
  'client.updated': ClientUpdatedPayload
  'client.deleted': ClientDeletedPayload
  'invoice.created': InvoiceCreatedPayload
  'invoice.updated': InvoiceUpdatedPayload
  'invoice.deleted': InvoiceDeletedPayload
  'invoice.paid': InvoicePaidPayload
  'employee.invited': EmployeeInvitedPayload
  'notification.created': NotificationCreatedPayload
  'notification.read': NotificationReadPayload
  'presence.user.online': PresenceUserOnlinePayload
  'presence.user.offline': PresenceUserOfflinePayload
  'presence.snapshot': PresenceSnapshotPayload
  'workspace.event': WorkspaceEventPayload
  'social.account.connected': SocialAccountConnectedPayload
  'social.account.disconnected': SocialAccountDisconnectedPayload
  'social.sync.completed': SocialSyncCompletedPayload
  'social.metrics.updated': SocialMetricsUpdatedPayload
  'social.insight.created': SocialInsightCreatedPayload
  'social.webhook.processed': SocialWebhookProcessedPayload
  'ai.run.completed': AiRunCompletedPayload
  'team.member.assigned': TeamMemberAssignedPayload
  'asset.updated': AssetUpdatedPayload
  'incident.created': IncidentCreatedPayload
  'incident.updated': IncidentUpdatedPayload
  'approval.completed': ApprovalCompletedPayload
  'finance.invoice.paid': FinanceInvoicePaidPayload
  /** Legacy snake_case aliases (same payloads) */
  task_created: TaskCreatedPayload
  task_updated: TaskUpdatedPayload
  task_deleted: TaskDeletedPayload
  task_submission_created: TaskSubmissionCreatedPayload
  comment_created: CommentCreatedPayload
  comment_updated: CommentUpdatedPayload
  project_created: ProjectCreatedPayload
  project_updated: ProjectUpdatedPayload
  project_deleted: ProjectDeletedPayload
  project_media_created: ProjectMediaCreatedPayload
  room_created: RoomCreatedPayload
  project_category_created: ProjectCategoryCreatedPayload
  client_created: ClientCreatedPayload
  client_updated: ClientUpdatedPayload
  client_deleted: ClientDeletedPayload
  invoice_created: InvoiceCreatedPayload
  invoice_updated: InvoiceUpdatedPayload
  invoice_deleted: InvoiceDeletedPayload
  employee_invited: EmployeeInvitedPayload
  alert: NotificationCreatedPayload
  alert_read: NotificationReadPayload
  user_online: PresenceUserOnlinePayload
  user_offline: PresenceUserOfflinePayload
  presence_snapshot: PresenceSnapshotPayload
  workspace_event: WorkspaceEventPayload
  social_account_connected: SocialAccountConnectedPayload
  social_account_disconnected: SocialAccountDisconnectedPayload
  social_sync_completed: SocialSyncCompletedPayload
  social_metrics_updated: SocialMetricsUpdatedPayload
  social_insight_created: SocialInsightCreatedPayload
  social_webhook_processed: SocialWebhookProcessedPayload
}
