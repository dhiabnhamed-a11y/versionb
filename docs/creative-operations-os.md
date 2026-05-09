# Creative Operations OS Architecture

TASKIT should evolve into an agency operating system, not a generic admin dashboard. The product center is creative flow: client requests, briefs, production work, review rooms, approvals, delivery, and billing all connected by activity, permissions, and automation.

## 1. System Architecture

Use a modular monolith on Next.js App Router with strict domain boundaries. Keep Prisma/PostgreSQL as the system of record, route handlers as the backend-for-frontend API, Socket.IO for live workspace events, and serverless-safe background execution for recurring automation and invoice reminders.

Core domains:

- `workspace`: companies, members, roles, invitations, settings, branding.
- `clients`: accounts, contacts, health, portal access, relationship timeline.
- `projects`: campaigns, productions, briefs, tasks, milestones, blockers.
- `deliverables`: uploaded media, versions, review status, approval decisions.
- `review`: timestamp comments, threaded replies, annotations, resolved states.
- `billing`: invoices, recurring schedules, taxes, discounts, PDFs, reminders.
- `automation`: triggers, actions, run logs, queue leases.
- `notifications`: in-app, realtime, email-ready events, unread state.
- `assistant`: operational summaries, risk detection, draft generation.

## 2. Database Schema

The current schema already has `Company`, `User`, `Client`, `Project`, `Task`, `ProjectMedia`, `Comment`, `Invoice`, `ClientActivity`, and `Alert`. Extend it instead of replacing it.

Recommended additions:

```prisma
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
}

model DeliverableVersion {
  id            String   @id @default(cuid())
  mediaId       String
  versionNumber Int
  status        String   @default("client_review")
  uploadedById  String
  changeNote    String?
  createdAt     DateTime @default(now())
}

model ApprovalDecision {
  id            String   @id @default(cuid())
  companyId     String
  clientId      String?
  projectId     String?
  mediaId       String?
  decidedById   String?
  status        String
  note          String?
  createdAt     DateTime @default(now())
}

model WorkflowTransition {
  id          String   @id @default(cuid())
  companyId   String
  entityType  String
  entityId    String
  fromState   String?
  toState     String
  actorId     String?
  metadata    Json?
  createdAt   DateTime @default(now())
}

model AutomationRule {
  id        String   @id @default(cuid())
  companyId String
  name      String
  enabled   Boolean  @default(true)
  trigger   Json
  actions   Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AutomationRun {
  id        String   @id @default(cuid())
  ruleId    String
  status    String
  input     Json?
  output    Json?
  error     String?
  createdAt DateTime @default(now())
}

model Notification {
  id          String   @id @default(cuid())
  companyId   String
  recipientId String
  type        String
  title       String
  body        String?
  href        String?
  readAt      DateTime?
  metadata    Json?
  createdAt   DateTime @default(now())
}
```

## 3. Folder Structure

Move toward domain-owned modules while keeping App Router routes explicit:

```txt
src/
  app/
    dashboard/
      admin/
      client/
      settings/
    api/
      clients/
      projects/
      deliverables/
      review/
      invoices/
      automations/
      notifications/
  components/
    dashboard/
    review/
    clients/
    invoices/
    workflow/
    ui/
  domains/
    clients/
      queries.ts
      mutations.ts
      policy.ts
      events.ts
    workflow/
    review/
    billing/
    automation/
    notifications/
  lib/
    db.ts
    auth.ts
    realtime-events.ts
```

## 4. Design System

The interface should default to a dark cinematic workspace:

- Surfaces: `--bg-primary`, `--bg-card`, `--bg-elevated`, `--sidebar-surface`.
- Borders: low-contrast glass borders and focused accent rings.
- Radius: 6, 8, 12, 16, 20.
- Elevation: quiet cards, floating command palette, modals with strong depth.
- Typography: compact operational UI with display type reserved for true page headers.
- Motion: 120ms hover, 220ms state change, 340ms larger shell movement.

Do not make cards the whole product. Use panels for repeated records and full-width work surfaces for review rooms, invoice editing, and workflow boards.

## 5. UI Architecture

Use server components for first data reads and small client islands for interactivity. Dashboard pages should follow:

- `page.tsx`: auth, query parsing, initial data.
- `*-client.tsx`: filters, optimistic updates, realtime refresh.
- domain query helpers for Prisma access.
- shared UI primitives for buttons, fields, status badges, empty states, skeletons.

## 6. Component Architecture

Reusable component groups:

- Shell: `CommandPalette`, `WorkspaceSwitcher`, `SidebarNav`, `NotificationCenter`.
- Clients: `ClientList`, `ClientProfileHeader`, `ClientHealth`, `ClientTimeline`.
- Review: `ReviewPlayer`, `TimelineMarkers`, `Waveform`, `CommentThread`, `ApprovalBar`.
- Workflow: `WorkflowBadge`, `TransitionMenu`, `ApprovalPipeline`.
- Billing: `InvoiceEditor`, `InvoicePreview`, `PaymentStatus`, `ReminderSchedule`.

## 7. API Architecture

Keep route handlers thin:

- Authenticate with `auth()`.
- Resolve company/workspace scope.
- Validate input.
- Call domain mutation/query.
- Emit realtime event.
- Return serialized DTO.

Use pagination and filtering on list routes by default. Route handlers are request-time by nature here because they depend on auth and workspace data.

## 8. Workflow Engine

Canonical creative states:

- `draft`
- `in_progress`
- `internal_review`
- `client_review`
- `needs_changes`
- `approved`
- `delivered`
- `archived`

Each state change writes `WorkflowTransition`, emits an activity event, evaluates automations, and creates targeted notifications.

## 9. Media Review Architecture

Model media as a deliverable with versions. Comments should support:

- `timestampStart`
- `timestampEnd`
- `frame`
- `x`, `y`, `width`, `height`
- `parentId`
- `resolvedAt`
- `resolvedById`

Audio review needs waveform peaks stored as JSON or generated client-side from the media URL. Video review needs marker overlays and frame-accurate comments where browser support allows. Image review needs point and rectangle annotations.

## 10. Client Portal

Use a separate route group for client-safe screens:

```txt
app/client-portal/[token]/
  page.tsx
  deliverables/[id]/page.tsx
  invoices/page.tsx
```

Portal access should be tokenized, scoped, expirable, and auditable. Clients should only see approved-for-client projects, selected deliverables, invoice status, and comment threads where they participate.

## 11. Automation Engine

Automation rules are JSON trigger/action definitions:

- Triggers: `brief.approved`, `deliverable.uploaded`, `invoice.overdue`, `project.delivered`.
- Conditions: client, project, amount, status age, assignee role.
- Actions: notify user/client, create invoice draft, update workflow state, send email, create task.

Execution can begin as a database-backed queue table with row leasing, then graduate to a hosted queue when needed.

## 12. Notifications

Replace generic alerts with semantic notification events:

- “Client requested changes at 01:24”
- “Invoice INV-1042 is 7 days overdue”
- “Campaign is waiting for internal review”

Every notification should include recipient, type, title, href, metadata, unread state, and realtime broadcast.

## 13. Performance Plan

- Paginate all list endpoints.
- Use server-rendered first paint for dashboards.
- Keep charts dynamically imported.
- Use optimistic SWR mutations for CRUD.
- Broadcast narrow realtime events by workspace.
- Add composite indexes for workspace/status/date queries.
- Avoid loading large review metadata until a deliverable opens.
- Use virtualized lists for high-volume timelines and notifications.

## 14. Premium UI Redesign Plan

Priority surfaces:

1. Shell: dark OS frame, command palette, collapsible sidebar, notification center.
2. Dashboard: actionable intelligence, not generic metrics.
3. Client profile: relationship command center with money, work, and review status.
4. Media review room: full-bleed player, marker timeline, comment rail.
5. Invoice editor: premium document builder with live PDF preview.

## 15. Scalable SaaS Strategy

The product should support workspaces, roles, invited users, client guests, branded portals, audit logs, usage-based storage limits, and paid plan gates. Keep tenant isolation at every query by `companyId`.

## 16. Migration Strategy

Phase 1:

- Introduce premium shell, command palette, design tokens.
- Add `Notification`, `WorkflowTransition`, `ApprovalDecision`.
- Normalize task stages to creative workflow states.

Phase 2:

- Add deliverable versions and richer media comments.
- Build client profile timeline and portal token access.
- Move invoice creation into a dedicated editor.

Phase 3:

- Add automation rules and queue runs.
- Add AI operations assistant summaries.
- Add portal approvals and branded PDF/payment reminders.

## 17. Production Details

- Use pure JavaScript PDF rendering such as `@react-pdf/renderer` for Vercel-compatible PDFs; avoid browser binaries in serverless routes.
- Keep Socket.IO custom server for local/realtime use, but isolate serverless-incompatible code.
- Protect all route handlers with auth and workspace policy helpers.
- Add audit logs for role, invoice, approval, and portal access changes.
- Add smoke tests for auth redirects, invoice PDF generation, client CRUD, media uploads, and workflow transitions.
