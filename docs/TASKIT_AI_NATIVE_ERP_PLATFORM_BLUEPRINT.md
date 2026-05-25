# TASKIT AI-Native ERP Platform Blueprint

Updated: 2026-05-25

## Product Thesis

TASKIT is a multi-tenant AI-native operating system for service businesses, agencies, operations teams, finance teams, executives, employees, and clients. It should not feel like disconnected SaaS pages. It should feel like one operational brain where every client, deal, task, invoice, contract, file, approval, workflow, report, and AI recommendation participates in the same governed workspace graph.

The product promise:

- Run the company from one connected command center.
- Convert business events into coordinated operational workflows.
- Make AI useful inside real work, not isolated in a chatbot.
- Give enterprise buyers trust through permissions, auditability, approvals, observability, and data isolation.
- Beat legacy ERP by making workflows faster, denser, clearer, and more adaptive.

## Operating Model

TASKIT should be built around five systems that reinforce each other:

1. Workspace graph: tenant-scoped entities and relationships across clients, projects, tasks, invoices, contracts, users, files, events, approvals, integrations, and AI memory.
2. Workflow engine: event-triggered orchestration for cross-module business processes.
3. Intelligence layer: AI copilots, forecasts, risk detection, anomaly detection, retrieval, summarization, and recommendations.
4. Control plane: RBAC, field permissions, approvals, audit logs, retention, SSO readiness, API keys, quotas, and compliance exports.
5. Experience layer: role-specific command centers, global search, command palette, smart tables, realtime collaboration, contextual side panels, and operational dashboards.

## Module Ecosystem

Core modules should remain independent enough to scale, but connected enough to behave like one ERP:

- Executive Dashboard
- CRM
- Sales Pipeline
- Client Lifecycle Management
- Projects
- Campaign Management
- Task System
- Kanban Workflows
- Team Collaboration
- File Management
- Contracts
- Finance and Accounting
- Invoices and Payments
- Procurement
- HR and Employee Management
- Knowledge Base
- Calendar and Scheduling
- Notifications Center
- AI Operations Assistant
- Automation Engine
- Workflow Builder
- Analytics and BI
- Reports Engine
- Client Portal
- Admin and Workspace Management
- Global Search
- Command Palette
- API and Integrations Hub
- Activity Logs
- Approval Systems

## Cross-Module Operating Loops

### Deal Closed

Trigger: sales opportunity moves to closed won.

Actions:

- Create or update client.
- Generate contract from deal terms.
- Create onboarding project and kickoff task set.
- Assign implementation team from capacity and role rules.
- Create initial invoice or billing schedule.
- Activate client portal.
- Schedule kickoff meeting.
- Notify account owner, finance, operations, and executive stakeholders.
- Update revenue forecast and pipeline conversion analytics.
- Start client health baseline.
- Write auditable activity trail.

### Project Status Changed

Trigger: project enters at-risk, blocked, complete, or scope-change state.

Actions:

- Update executive dashboard and client health score.
- Recalculate workload and utilization.
- Trigger manager notification or approval chain.
- Refresh billing state and revenue recognition assumptions.
- Update profitability and delivery forecast.
- Ask AI to summarize risk, recommended action, owner, and deadline.
- Sync relevant client portal timeline.

### Invoice Overdue

Trigger: invoice crosses payment due date or risk threshold.

Actions:

- Notify finance and account manager.
- Update client health and financial risk score.
- Generate follow-up workflow.
- Schedule reminder sequence.
- Pause optional noncritical work if policy requires.
- Surface exposure in executive dashboard.
- Audit all actions and communications.

### Employee Capacity Risk

Trigger: workload exceeds configured role capacity or delivery SLA is threatened.

Actions:

- Alert operations and project managers.
- Recommend reassignment or timeline change.
- Update project risk and forecast.
- Create staffing approval if contractor or overtime is required.
- Notify finance if margin impact is material.

## Data Architecture

### Tenant Foundation

Every business record must carry tenant context directly or through a strict parent relationship. Repository access must enforce tenant scope by default.

Primary tenant entities:

- Organization
- Workspace
- Department
- Team
- User
- Role
- Permission
- Membership
- AuditEvent
- ActivityEvent
- ApiCredential
- IntegrationConnection

### Operational Entity Families

Commercial:

- Lead
- Account
- Contact
- Opportunity
- Quote
- Contract
- Client
- ClientPortalAccess

Delivery:

- Project
- Milestone
- Task
- KanbanBoard
- Sprint or WorkCycle
- Deliverable
- FileAsset
- Comment
- ApprovalRequest

Finance:

- ChartOfAccount
- JournalEntry
- LedgerTransaction
- Invoice
- Payment
- Expense
- Budget
- PurchaseOrder
- Vendor
- PayrollRun
- FiscalPeriod

Automation and AI:

- WorkflowDefinition
- WorkflowRun
- WorkflowStepRun
- AutomationTrigger
- AutomationAction
- AiRun
- AiMemory
- AiRecommendation
- AiRiskSignal
- AiApproval
- KnowledgeChunk

Analytics:

- MetricSnapshot
- ForecastRun
- ClientHealthSnapshot
- WorkloadSnapshot
- RevenueSnapshot
- ReportDefinition
- ReportRun

### Relationship Rules

- Deals can create clients, contracts, invoices, projects, and forecasts.
- Projects can link clients, contracts, tasks, files, invoices, budgets, approvals, and reports.
- Invoices can link clients, projects, contracts, ledger entries, payments, alerts, and risk signals.
- Tasks can link approvals, files, comments, projects, automation runs, and AI recommendations.
- Every mutation should emit an activity event and optional domain event.

## Backend Architecture

Use a modular monolith as the first-class architecture, designed to become service-split when scale demands it.

Runtime boundaries:

- Web app and BFF: Next.js App Router, server components where possible, client components for interactive work surfaces.
- API platform: governed `/api/v1` contracts, canonical envelopes, request IDs, permission metadata, idempotency for risky writes.
- Domain modules: services, repositories, validators, policies, DTOs, and tests per module.
- Job workers: AI, notifications, media, finance posting, reporting, exports, integrations, and scheduled workflows.
- Realtime gateway: Socket.IO with Redis adapter, tenant rooms, replayable events, presence, and connection health.
- Integration runtime: OAuth, webhook verification, provider adapters, sync jobs, rate limit handling, and audit.

## Event-Driven Architecture

Domain events are the connective tissue of the ERP.

Event envelope:

- eventId
- tenantId
- actorId
- entityType
- entityId
- eventType
- occurredAt
- causationId
- correlationId
- idempotencyKey
- payloadVersion
- payload
- sensitivity

Event channels:

- Internal event bus for same-process orchestration.
- Durable event log for replay, audit, and recovery.
- Queue fanout for async jobs.
- Realtime projection for UI synchronization.
- Analytics projection for BI and materialized views.

Critical event types:

- deal.closed
- client.created
- contract.generated
- invoice.created
- invoice.overdue
- project.status_changed
- task.completed
- approval.requested
- approval.decided
- payment.received
- workflow.run_started
- workflow.run_failed
- ai.recommendation.created
- permission.changed

## Automation Engine

The automation engine should be comparable to Zapier, Make, and n8n, but tenant-aware and ERP-native.

Core primitives:

- Trigger: event, schedule, webhook, manual action, AI-detected condition.
- Condition: entity filter, amount threshold, role rule, SLA rule, risk score, custom expression.
- Branch: if/else, switch, parallel branch, approval outcome.
- Delay: duration, business-hours delay, due-date relative delay.
- Action: create/update record, notify, assign, generate document, call integration, run AI, create approval, enqueue report.
- Guardrail: permission check, tenant boundary, idempotency, approval requirement, audit event.
- Run state: queued, running, waiting, approved, failed, retried, canceled, complete.

Builder UX:

- Left rail for triggers/actions.
- Canvas for workflow graph.
- Right side panel for configuration.
- Inline test mode with sample records.
- Impact preview showing affected modules, permissions, notifications, and costs.
- Version history and rollback.

## AI Architecture

AI is a governed operations layer, not a chat bubble.

AI responsibilities:

- Summarize operational state.
- Detect project delays.
- Predict churn and payment risk.
- Forecast revenue, margin, and workload.
- Generate reports.
- Recommend next actions.
- Build workflows from natural language.
- Explain anomalies.
- Answer workspace questions using permission-aware retrieval.
- Draft contracts, invoice notes, client updates, and executive briefs.

AI control model:

- Retrieval must respect tenant, role, field, and module permissions.
- High-impact actions require approval.
- Every AI run stores inputs, tool calls, outputs, model, cost, latency, actor, and decision trace.
- Prompt injection checks run before tool execution.
- Recommendations should show confidence, evidence, owner, due date, and expected impact.

AI surfaces:

- Executive brief panel.
- Finance anomaly queue.
- Project delay detector.
- Client risk cockpit.
- Workflow builder assistant.
- Report generator.
- Command palette actions.
- Contextual side panel on records.

## RBAC and Security

Access model:

- System roles: Owner, Admin, Manager, Finance, Member, Client, Auditor, Super Admin.
- Custom roles: tenant-defined permissions.
- Module permissions: view, create, update, delete, export, approve, administer.
- Field permissions: sensitive finance, salary, legal, AI memory, client secrets.
- Record permissions: owner, department, team, project, client portal scope.
- Action permissions: post journal entry, approve payment, generate contract, execute workflow, run AI tool.

Security controls:

- Tenant-scoped queries by default.
- MFA for privileged users.
- SSO-ready identity boundaries.
- Session revocation and device visibility.
- Origin and CSRF checks for mutations.
- Webhook signatures.
- Upload validation and malware scan hooks.
- API keys with scopes, expirations, and rotation.
- Audit logs for every mutation, export, approval, permission change, AI action, and integration event.

## Analytics and BI

BI should run on derived projections and snapshots, not expensive dashboard queries.

Executive metrics:

- Revenue forecast
- Pipeline conversion
- Client health
- Gross margin
- Project profitability
- Workload risk
- Cash runway
- AR aging
- Automation savings
- AI recommendation acceptance

Operational metrics:

- SLA exposure
- Task throughput
- Cycle time
- Approval bottlenecks
- Team utilization
- Project delay probability
- Escalation volume
- Rework rate

Finance metrics:

- Cash position
- Budget variance
- AP/AR summary
- Expense trend
- Payroll forecast
- Invoice aging
- Profitability by client and project
- Close readiness

## UX Strategy

TASKIT should feel dense, clear, fast, and trustworthy. Enterprise users should see more signal with less friction.

Global UX primitives:

- Persistent command palette.
- Permission-aware global search.
- Role-specific navigation.
- Smart tables with saved views, filters, sorting, bulk actions, and export rules.
- Contextual right-side record panels.
- Sticky action bars for approvals and workflow decisions.
- Realtime presence and activity.
- Notification center with priority, ownership, and resolution state.
- Advanced empty states that suggest imports, templates, and automations.
- Keyboard-first navigation for power users.

Role command centers:

- CEO: company health, forecast, cash, margin, client risk, strategic exceptions.
- Finance: cash, AR/AP, approvals, journals, close, expenses, budgets, audit evidence.
- Operations: workload, SLA, bottlenecks, automations, teams, project risk.
- Project Manager: tasks, timeline, blockers, files, client approvals, profitability.
- Sales: pipeline, next actions, contract status, handoff readiness.
- HR: headcount, payroll, leave, employee workload, compliance.
- Client: portal approvals, invoices, files, milestones, requests.
- Admin: users, roles, integrations, audit, workflow governance, billing.

## Visual Design Direction

Design language:

- Premium, operational, restrained, and high-trust.
- Dense layouts with strong hierarchy.
- Neutral surfaces with clear semantic color, not decorative color overload.
- 8px card radius unless a local component pattern requires otherwise.
- Tables and command surfaces should feel like professional instruments.
- Charts should prioritize comparison, deltas, thresholds, and drilldown.
- AI UI should show evidence, impact, and actionability.

Component systems:

- Data table
- KPI strip
- Entity timeline
- Approval drawer
- Command palette
- Global search
- Workflow canvas
- Automation run log
- Audit viewer
- Report builder
- Forecast chart
- Risk queue
- Notification inbox
- Client portal timeline

## Infrastructure Strategy

Production topology:

- Web/API runtime
- Realtime gateway
- General worker
- AI worker
- Media worker
- Notification worker
- Integration worker
- Queue and dead-letter queue
- Redis cache and socket adapter
- Primary database
- Read replicas or analytics warehouse when needed
- Object storage and CDN
- Observability stack

Caching:

- Tenant-scoped cache keys.
- Short-lived dashboard cache.
- Permission-aware query cache.
- Materialized analytics snapshots.
- AI retrieval cache with invalidation on source changes.
- Integration rate-limit cache.

Observability:

- Request ID across API, jobs, events, realtime, and AI runs.
- Metrics for latency, errors, queue depth, retries, DLQ, AI cost, token usage, socket health, and tenant hotspots.
- Structured logs with tenant and actor context.
- Audit logs separate from application logs.
- SLO dashboards for API, realtime, workflows, AI, billing, and finance posting.

Reliability:

- Idempotency for external callbacks and critical writes.
- Retry policy with exponential backoff.
- Dead-letter queues with replay tooling.
- Circuit breakers for integrations and AI providers.
- Graceful degradation for AI and realtime.
- Backups, restore tests, legal hold, and disaster recovery runbooks.

## Delivery Roadmap

### Phase 1: Control Plane Consolidation

- Finish `/api/v1` migration for finance, invoices, projects, contracts, AI, integrations, and exports.
- Enforce permission metadata on canonical routes.
- Expand durable idempotency to all replay-risk writes.
- Centralize audit logging for mutations and AI actions.
- Add materialized dashboard projections.

### Phase 2: ERP Graph and Workflow Engine

- Formalize domain events and durable event log.
- Build workflow definitions, run state, and action registry.
- Add event-driven automations for deal close, project risk, invoice overdue, approvals, and onboarding.
- Add workflow run viewer and retry controls.
- Add role-specific command centers.

### Phase 3: AI Operations Layer

- Permission-aware retrieval for workspace questions.
- Risk detection for projects, clients, finance, and workload.
- AI report generation with cited workspace evidence.
- Workflow builder assistant.
- Governance UI for AI runs, approvals, costs, and safety events.

### Phase 4: Enterprise Readiness

- SSO and SCIM.
- Field-level permissions.
- Audit export and retention controls.
- API key management and integrations marketplace.
- Advanced analytics warehouse path.
- Load tests for tenant isolation, realtime, AI concurrency, and finance volume.

## North Star

TASKIT wins if an executive, finance manager, operator, project manager, salesperson, admin, employee, and client can all use the same workspace and feel that the system understands how the business actually moves.

The product should make every important business event answer three questions instantly:

- What changed?
- Who needs to act?
- What should happen next?
