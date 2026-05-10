# TASKIT OS: Agency Operations Platform

TASKIT OS is an enterprise agency operations platform that combines project management, CRM, client portals, approvals, billing, automation, analytics, AI assistance, and resource planning inside one workspace. The product goal is to remove operational chaos by connecting every client promise to delivery, approval, invoice, payment, and reporting workflows.

## Product Architecture

The platform should remain a modular monolith until domain traffic requires service extraction. Next.js App Router owns the web application and backend-for-frontend route handlers. Prisma and PostgreSQL are the system of record. Background workers process automations, recurring invoices, reminders, analytics rollups, and AI summaries. Realtime channels broadcast comments, task movement, approvals, and notifications.

Primary domains:

- Workspace: organizations, roles, members, invitations, settings, white label branding, domains, audit policy.
- Identity: secure login, signup, social auth, email verification, password reset, sessions, 2FA, client portal tokens.
- CRM: clients, contacts, contracts, notes, files, activities, health, communication log.
- Delivery: projects, tasks, subtasks, statuses, dependencies, milestones, calendar, timeline, comments.
- Briefs: onboarding forms, campaign briefs, service requests, dynamic workflow generation.
- Deliverables: file versions, previews, annotations, approvals, revisions, audit trail.
- Billing: invoices, line items, taxes, discounts, PDF export, Stripe, PayPal, recurring schedules.
- Collaboration: mentions, internal notes, activity feeds, notifications, realtime presence.
- Automation: triggers, conditions, actions, runs, queue leases, execution logs.
- AI: chat assistant, summaries, task generation, risk detection, report generation, smart search.
- Analytics: revenue, profitability, utilization, workload, SLA, project health, productivity.
- Knowledge: SOPs, documents, guides, brand assets, internal wiki.
- Integrations: Slack, Discord, Drive, Figma, Zoom, Stripe, PayPal, Calendar, Outlook, Zapier.

## App Structure

```txt
src/
  app/
    page.tsx
    dashboard/
      admin/
        page.tsx
        clients/
        projects/
        tasks/
        invoices/
        calendar/
        employees/
      client/
        page.tsx
      settings/
    portal/
      [token]/
        page.tsx
        approvals/
        invoices/
        requests/
    api/
      auth/
      workspaces/
      clients/
      projects/
      tasks/
      briefs/
      deliverables/
      approvals/
      invoices/
      automations/
      analytics/
      ai/
  components/
    agency-os/
    dashboard/
    clients/
    projects/
    billing/
    automation/
    ai/
    portal/
    ui/
  domains/
    workspace/
    clients/
    delivery/
    billing/
    automation/
    ai/
    analytics/
    permissions/
  lib/
    auth.ts
    db.ts
    security.ts
    realtime-events.ts
```

## Permission System

Roles:

- Owner: full workspace, billing, users, white label, exports, security, audit logs.
- Admin: workspace operations, clients, projects, invoices, automations, reports, team.
- Manager: assigned clients/projects, resource planning, approvals, reports, workload.
- Team Member: assigned tasks, subtasks, files, comments, timers, internal notes.
- Client: portal-only access to approved projects, deliverables, invoices, requests, reports.

Every route handler should resolve the authenticated workspace, evaluate a policy function, validate input, execute a domain query/mutation, write an audit log for sensitive changes, emit an event, then return a DTO.

## Database Schema Additions

The current Prisma schema already includes users, companies, clients, projects, tasks, invoices, briefs, deliverables, approvals, comments, alerts, and media. Add the following production entities as the platform expands:

```prisma
model WorkspaceMembership {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  role        String
  permissions Json?
  invitedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([workspaceId, userId])
  @@index([workspaceId, role])
}

model ClientContact {
  id        String   @id @default(cuid())
  clientId  String
  name      String
  email     String?
  phone     String?
  title     String?
  isPrimary Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([clientId, isPrimary])
}

model ClientPortalAccess {
  id        String    @id @default(cuid())
  clientId  String
  tokenHash String    @unique
  scope     Json
  expiresAt DateTime?
  lastUsedAt DateTime?
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([clientId, revokedAt, expiresAt])
}

model TimeEntry {
  id          String    @id @default(cuid())
  workspaceId String
  taskId      String?
  userId      String
  startedAt   DateTime
  stoppedAt   DateTime?
  minutes     Int       @default(0)
  billable    Boolean   @default(true)
  note        String?
  createdAt   DateTime  @default(now())

  @@index([workspaceId, userId, startedAt])
  @@index([taskId, startedAt])
}

model FileAsset {
  id          String   @id @default(cuid())
  workspaceId String
  clientId    String?
  projectId   String?
  folderId    String?
  uploadedById String
  name        String
  mimeType    String
  size        Int
  url         String
  version     Int      @default(1)
  tags        String[]
  createdAt   DateTime @default(now())

  @@index([workspaceId, clientId, createdAt])
  @@index([workspaceId, projectId, createdAt])
}

model AutomationRule {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  enabled     Boolean  @default(true)
  trigger     Json
  conditions  Json?
  actions     Json
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([workspaceId, enabled])
}

model AutomationRun {
  id        String   @id @default(cuid())
  ruleId    String
  status    String
  input     Json?
  output    Json?
  error     String?
  startedAt DateTime @default(now())
  endedAt   DateTime?

  @@index([ruleId, startedAt])
  @@index([status, startedAt])
}

model Notification {
  id          String    @id @default(cuid())
  workspaceId String
  recipientId String
  type        String
  title       String
  body        String?
  href        String?
  readAt      DateTime?
  metadata    Json?
  createdAt   DateTime  @default(now())

  @@index([workspaceId, recipientId, readAt, createdAt])
}

model AuditLog {
  id          String   @id @default(cuid())
  workspaceId String
  actorId     String?
  action      String
  entityType  String
  entityId    String?
  ipAddress   String?
  userAgent   String?
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([workspaceId, entityType, entityId, createdAt])
  @@index([workspaceId, actorId, createdAt])
}

model AnalyticsSnapshot {
  id          String   @id @default(cuid())
  workspaceId String
  period      String
  startsAt    DateTime
  endsAt      DateTime
  metrics     Json
  createdAt   DateTime @default(now())

  @@unique([workspaceId, period, startsAt])
}

model AiConversation {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  title       String?
  context     Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([workspaceId, userId, updatedAt])
}

model AiMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String
  content        String
  citations      Json?
  createdAt      DateTime @default(now())

  @@index([conversationId, createdAt])
}
```

## API Architecture

Use route handlers as thin controllers:

- `GET /api/clients`: paginated CRM list with health and revenue summary.
- `POST /api/clients`: create account, contacts, activity entry, optional portal.
- `GET /api/projects`: filtered list, board data, timeline data, workload summary.
- `POST /api/briefs`: create brief, evaluate automation rules, optionally generate tasks.
- `POST /api/deliverables/[id]/approvals`: approve, reject, request changes, write audit.
- `POST /api/invoices`: create invoice with taxes, discounts, client snapshot, PDF metadata.
- `POST /api/automations/rules`: create no-code rule with validated trigger/action schema.
- `POST /api/ai/chat`: scoped assistant call with workspace context and retrieval safeguards.
- `GET /api/analytics/executive`: revenue, utilization, profitability, SLA, project health.

## Automation Engine

Automation model:

```txt
Event -> Trigger Match -> Condition Evaluation -> Queue Run -> Action Executor -> Audit/Event/Notification
```

Supported triggers:

- `client.created`
- `brief.accepted`
- `project.completed`
- `task.overdue`
- `file.uploaded`
- `deliverable.approved`
- `invoice.overdue`
- `invoice.paid`

Supported actions:

- Create workspace, project, task, invoice, report.
- Notify user, team, client, Slack, Discord.
- Update status, health score, analytics, SLA timer.
- Send email reminder.
- Generate AI summary.

## AI System

The AI assistant should be contextual and permission-scoped. It can summarize projects, generate tasks from briefs, draft invoice descriptions, detect delayed projects, create reports, surface client insights, recommend workload changes, and search across workspace knowledge. It must never expose client-private or admin-only data to users without permission.

Architecture:

- Retrieval layer: workspace-scoped clients, projects, briefs, deliverables, invoices, docs.
- Policy layer: filters context based on role and entity access.
- Tool layer: create task, draft invoice, summarize project, generate report, search docs.
- Audit layer: log AI actions that mutate data or generate externally visible content.

## UX System

The product should feel like a dense enterprise command center:

- Dark OS shell with glass accents, restrained gradients, and compact typography.
- Command palette for global search and quick actions.
- Persistent notification center and activity timeline.
- Smart filters, saved views, keyboard shortcuts, drag and drop boards.
- Skeleton loading, empty states, optimistic updates, and realtime collaboration.
- Client portal as a separate branded workspace, not a stripped-down admin screen.

## Production Roadmap

Phase 1: premium shell, executive dashboard, CRM, projects, invoices, briefs, deliverables.

Phase 2: client portal, approval center, file versioning, annotations, workflow state machine.

Phase 3: automation builder, background jobs, notifications, recurring billing, analytics rollups.

Phase 4: AI assistant, smart search, report generation, risk detection, recommendations.

Phase 5: white label, custom domains, enterprise audit, granular permissions, integrations.
