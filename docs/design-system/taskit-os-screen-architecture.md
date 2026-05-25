# TASKIT OS Screen Architecture

This document defines the full screen system for TASKIT across marketing, authentication, onboarding, workspace operations, finance, collaboration, AI, and admin.

## Universal App Shell

Desktop:
- Sidebar 248px, fixed left, full height.
- Topbar 64px, fixed top inside main area.
- Main starts at x=248, y=64, padding 32px.
- Content max width 1360px unless data-heavy pages require full width.
- Sidebar groups: Workspace, Work, Business, Intelligence, Admin.
- Topbar: workspace switcher context, command search, create menu, notifications, help, avatar.

Tablet:
- Sidebar collapses to 72px icon rail.
- Topbar search becomes 320px max.
- Main padding 24px.

Mobile 375px:
- Sidebar becomes 5-item bottom nav: Home, Work, CRM, Inbox, More.
- Topbar is 56px with workspace name, search icon, create icon.
- Main padding 20px.
- Tables become card stacks.
- Drawers become full-screen sheets.

## 01. Landing Page

Layout:
- 64px sticky nav, 1200px max content, logo left, links center, CTA right.
- Hero uses 12-column grid. Left spans 5 columns, right product screenshot spans 7.
- Headline: "Run every client operation from one OS." Keep under 9 words.
- Subtext: two lines max, 18px body.
- Product visual is a real TASKIT dashboard mockup, not a stock image.
- Section rhythm: hero 96px top, 80px bottom; proof 48px; feature sections 96px.

Hierarchy:
- Primary CTA "Start free" is the only filled button above fold.
- Secondary "Watch demo" is ghost with play icon.
- Product screenshot confirms the claim immediately.

Interactions:
- Nav blurs after 24px scroll.
- Hero screenshot has hover scrub: small highlights reveal CRM, projects, finance, AI.
- Chat widget opens in bottom-right.
- FAQ uses accordion with one open by default.

Responsive:
- Mobile nav uses menu drawer.
- Hero stacks with screenshot below CTAs.
- Feature grid becomes one column.
- Logo strip scrolls horizontally.

Accessibility:
- Screenshot has descriptive alt and linked text transcript.
- Chat widget has aria-live unread state.
- FAQ uses semantic button headings.

Rationale:
The landing page sells operational trust before features. The hero shows the product as the proof, then social proof, workflow sections, screenshots, testimonials, integrations, pricing, FAQ, and security reduce buyer risk in order.

## 02. Pricing Page

Layout:
- Header 720px max width, left-aligned.
- Billing toggle below header, 40px tall.
- Three cards: Starter, Studio, Scale. 24px gaps, 32px padding.
- Feature comparison table below, grouped by Core work, Collaboration, Finance, Security, AI.
- Cancellation policy callout before final CTA.

Hierarchy:
- Recommended plan has brand border and "Best for growing agencies" badge.
- Enterprise plan uses "Talk to sales" secondary CTA.

Interactions:
- Toggle changes prices with 150ms fade.
- Feature rows reveal detail tooltip.
- FAQ accordion supports keyboard.

Responsive:
- Cards stack with recommended first.
- Comparison table becomes grouped accordion cards.

Accessibility:
- Toggle exposes selected state.
- Price changes announced politely.

Rationale:
Pricing supports both self-serve and procurement. Cancellation, security, and support signals stay visible to reduce perceived risk.

## 03. Authentication Pages

Includes sign in, sign up, reset password, invite acceptance, and MFA.

Layout:
- Split 52/48 desktop. Brand panel left, form right.
- Form max width 420px.
- Fields stack with 16px gaps, actions with 24px top margin.
- OAuth buttons are secondary, 40px high.

Hierarchy:
- One primary form action.
- Recovery links are tertiary.
- Error banner sits above fields.

Interactions:
- Password reveal toggles icon and label.
- Submit disables fields and locks button width.
- OAuth opens provider flow.
- Invite acceptance pre-fills workspace context.

Responsive:
- Brand panel compresses to top banner.
- Form gets 20px padding.

Accessibility:
- Field errors are linked through aria-describedby.
- MFA code inputs support paste.

Rationale:
Authentication must feel secure and quiet. The form prioritizes completion while the brand panel reassures the user that TASKIT is a serious work platform.

## 04. Onboarding Flow

Layout:
- Centered 960px workflow card.
- Progress header with 4 steps: Workspace, Modules, Import, Team.
- Each step has one primary task and one secondary skip path.

Steps:
- Workspace: name, company type, timezone.
- Modules: choose default modules using check cards.
- Import: CSV contacts, projects, clients, or skip.
- Team: invite by email, role, workspace access.

Interactions:
- Autosaves progress.
- Import validates headers and previews first 10 rows.
- Module selection updates live workspace preview.
- Completion shows subtle celebration and "Go to dashboard".

Responsive:
- Full-screen mobile stepper.
- Sticky bottom action bar.

Accessibility:
- Progress is semantic.
- Import drop zone has keyboard upload alternative.

Rationale:
Onboarding builds confidence by showing progress and reducing setup to meaningful choices. Defaults do most of the work.

## 05. Dashboard

Layout:
- Page header: greeting, primary date range filter, create button.
- KPI grid: 4 cards, 24px gaps.
- Main grid: 8-column operational overview, 4-column activity/right rail.
- Lower section: priority work table, AI recommendations, calendar strip.

Widgets:
- Revenue at risk.
- Open client work.
- Invoices awaiting action.
- Team capacity.
- Recent activity.
- AI "What changed since yesterday?"

Interactions:
- KPI click filters downstream content.
- AI recommendation can create task, assign owner, dismiss.
- Activity item opens source object.

Responsive:
- KPI grid 2x2 mobile.
- Right rail moves below.
- Tables become cards.

Accessibility:
- KPI deltas include text, not only color.
- Charts include data summary.

Rationale:
The dashboard is an operations briefing. It answers what changed, what is at risk, and what needs action today.

## 06. CRM

Layout:
- Saved views row: All clients, Active, At risk, Prospects.
- Filter bar: search, owner, status, value, activity date.
- Split options: table default, pipeline board optional.
- Client detail opens in full page with right-side relationship panel.

Components:
- Client table.
- Contact cards.
- Deal/opportunity timeline.
- Relationship health badge.

Interactions:
- Inline edit key fields.
- Bulk assign owner.
- Save view.
- Open client from table row.

Responsive:
- Table becomes client cards with top metadata.
- Filters move to bottom sheet.

Accessibility:
- Sort state announced.
- Bulk selection count announced.

Rationale:
CRM is a relationship system, not a spreadsheet. Tables support power users while detail pages surface context and next action.

## 07. Projects And Campaigns

Layout:
- Header has tabs: Projects, Campaigns, Clients, Archive.
- Board/list/timeline view switch.
- Project cards show client, phase, owner, due date, budget status, blocked count.
- Detail view: overview, tasks, files, approvals, invoices, activity.

Interactions:
- Create project opens drawer with client, template, dates, team.
- Timeline drag updates due dates.
- Template picker previews workflow.

Responsive:
- View switch collapses to dropdown.
- Cards stack.

Accessibility:
- Timeline has list alternative.

Rationale:
Projects connect work, client communication, and money. The design makes project health scannable before task detail.

## 08. Tasks And Kanban

Layout:
- Kanban columns: Backlog, To do, In progress, Review, Done.
- Column width 304px, 16px gap.
- Task card: title, project, assignee, due date, priority, comments.
- List view for bulk management.

Interactions:
- Drag card with optimistic update.
- Keyboard reorder.
- Quick add at column bottom.
- Task detail opens drawer.

Responsive:
- Mobile shows one column at a time with stage tabs.

Accessibility:
- Drag announcements and keyboard move controls.

Rationale:
Kanban is for flow; list view is for throughput and cleanup. Both share filters and saved views.

## 09. Client Portal

Layout:
- External-facing shell with simplified nav: Home, Projects, Files, Invoices, Messages.
- Client dashboard shows active work, pending approvals, recent files, unpaid invoices.
- Approval cards have clear accept/request changes actions.

Interactions:
- Client can comment on deliverables.
- Approval creates audit event.
- File preview supports annotations.

Responsive:
- Mobile-first, client-safe layout.

Accessibility:
- External users receive clear focus states and plain-language labels.

Rationale:
The portal builds trust with clients by showing status, decisions, and documents without exposing internal complexity.

## 10. Finance And Invoices

Layout:
- Finance dashboard with revenue, outstanding invoices, overdue, margin.
- Invoice table with status, client, due date, amount, owner.
- Invoice detail: preview left, metadata/actions right.

Interactions:
- Create invoice from project/client.
- Send invoice opens confirmation.
- Payment status updates optimistic with reconciliation notice.
- Download PDF.

Responsive:
- Invoice table becomes cards.
- Preview opens full-screen.

Accessibility:
- Currency values use full text labels for screen readers.

Rationale:
Finance screens must feel precise and controlled. The visual treatment reduces anxiety around money and status.

## 11. Contracts

Layout:
- Contract library table with status, client, value, renewal, owner.
- Detail page: document viewer, terms summary, approval trail, signatures.
- Create flow starts from template selection.

Interactions:
- Send for signature.
- Compare versions.
- Approval comments anchor to document sections.

Responsive:
- Viewer becomes tabbed: Summary, Document, Activity.

Accessibility:
- Document actions are keyboard accessible.

Rationale:
Contracts require auditability. Version history and approval trail are first-class, not hidden metadata.

## 12. Team Collaboration

Layout:
- Team page shows members, roles, workload, availability, recent activity.
- Collaboration panel appears inside object pages.
- Comments use threaded replies, mentions, attachments.

Interactions:
- Mention opens user picker.
- Resolve thread.
- Assign action from comment.

Responsive:
- Team table stacks into member cards.

Accessibility:
- Mentions and comment composer announce suggestions.

Rationale:
Collaboration is embedded where work happens. A separate team page exists for management, but object pages carry the conversation.

## 13. Notifications

Layout:
- Full page notification center plus dropdown summary.
- Groups: Today, This week, Earlier.
- Filters: Mentions, Assignments, Approvals, Finance, System.

Interactions:
- Mark all read.
- Notification opens object.
- Snooze selected notification.

Responsive:
- Filters become horizontal chips.

Accessibility:
- Unread state uses text and weight, not color only.

Rationale:
Notifications are a triage workflow. The system must reduce noise and make source objects obvious.

## 14. AI Assistant

Layout:
- Right panel 420px desktop.
- Header shows current context and source count.
- Messages support user prompts, AI replies, action cards, citations.
- Inline AI chips appear in modules: summarize, draft, suggest, detect risk.

Interactions:
- Accept suggestion creates object or updates fields.
- Edit before applying.
- Source links jump to records.
- Feedback thumbs up/down.

Responsive:
- Full-screen mobile assistant.

Accessibility:
- Conversation uses live regions carefully.
- Generated actions are explicit buttons.

Rationale:
AI should accelerate decisions without reducing trust. Source links and edit-before-apply keep users in control.

## 15. Analytics

Layout:
- Saved report tabs.
- Filter rail top with date, client, owner, project, module.
- Dashboard grid with charts and data tables.
- Export and schedule report controls.

Interactions:
- Chart click filters report.
- Save report view.
- Schedule email digest.

Responsive:
- Charts stack.
- Filter rail becomes drawer.

Accessibility:
- Every chart has accessible table summary.

Rationale:
Analytics supports decision-making, not decoration. Each chart links back to source records.

## 16. Calendar

Layout:
- Week view default.
- Left mini calendar and filters on desktop.
- Activity types: meeting, deadline, task, invoice due, approval.
- List view available.

Interactions:
- Drag reschedule.
- Quick create from time slot.
- Filter by owner/client/project.

Responsive:
- Agenda list default on mobile.

Accessibility:
- Calendar grid has keyboard navigation and list alternative.

Rationale:
Calendar connects commitments across modules. It is not just events; it is operational time.

## 17. File Management

Layout:
- Toolbar: search, type, owner, project, upload.
- Folder/file grid with list toggle.
- Preview drawer with comments, versions, linked records.

Interactions:
- Drag upload.
- Multi-select bulk move/download/delete.
- Version compare.

Responsive:
- Grid becomes 2 columns, preview full screen.

Accessibility:
- Upload has button fallback and progress announcements.

Rationale:
Files are operational artifacts. Linking files to projects, contracts, and approvals prevents asset sprawl.

## 18. Settings And User Profile

Layout:
- Settings shell with left nav: Profile, Workspace, Team, Security, Notifications, Integrations, API, Billing.
- Profile form 720px max.
- Security cards for password, MFA, sessions.
- Workspace settings include branding, modules, default views.

Interactions:
- Unsaved changes bar.
- Avatar drag upload.
- Revoke session confirmation.
- API key reveal/copy with audit toast.

Responsive:
- Settings nav becomes sticky horizontal tabs.

Accessibility:
- Forms use proper labels and error summaries.

Rationale:
Settings are grouped by job to be done. Dangerous actions are available but separated and confirmed.

## 19. Workspace Switching

Layout:
- Workspace switcher in sidebar top.
- Popover 360px wide, search, recent workspaces, pinned, create/join.
- Shows role and environment badge.

Interactions:
- Cmd+K can switch workspace.
- Recent workspaces update after switch.
- Create workspace opens onboarding.

Responsive:
- Full-screen workspace switch sheet.

Accessibility:
- Roving tabindex listbox behavior.

Rationale:
Multi-workspace users need fast switching without losing context or mixing client data.

## 20. Admin Panel

Layout:
- Admin overview with tenant health, approvals, billing risk, active users, audit events.
- Tables for companies, users, access requests, legal controls.
- Detail pages use admin object header and audit trail.

Interactions:
- Approve/reject with reason.
- Impersonation requires confirmation and audit reason.
- Export audit log.

Responsive:
- Tables become stacked records with critical actions visible.

Accessibility:
- Admin actions require clear labels and confirmation.

Rationale:
Admin screens prioritize risk and governance. High-impact actions are explicit and auditable.

## 21. Command Palette

Layout:
- Center modal 640px wide.
- Search input top, grouped results below.
- Result rows 44px, icon, title, metadata, shortcut.

Interactions:
- Opens with Cmd/Ctrl+K.
- Supports actions, navigation, create flows, recent objects.
- Arrow keys navigate, Enter selects, Esc closes.

Responsive:
- Full-width mobile sheet with 20px margins.

Accessibility:
- Combobox pattern with active descendant.

Rationale:
The command palette is the expert-user accelerator and reduces navigation friction across a large product.
