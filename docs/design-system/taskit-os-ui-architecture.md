# TASKIT OS UI Architecture And Production Rules

## Build Order

1. Tokens and global theme provider.
2. App shell: sidebar, topbar, bottom nav, workspace switcher.
3. Core primitives: button, icon button, field, input, select, checkbox, radio, toggle, badge, avatar, skeleton.
4. Shared patterns: card, stat card, data table, empty state, toast, modal, drawer, tooltip, popover, tabs, breadcrumbs.
5. Work patterns: object header, activity feed, comment composer, file preview, kanban board, filter bar, saved views.
6. Module pages: dashboard, CRM, projects, tasks, finance, contracts, files, analytics, calendar, settings, admin.
7. Marketing and auth polish.

This order prevents each page from inventing its own UI language.

## Information Architecture

Primary navigation:
- Home: Dashboard
- Work: Projects, Campaigns, Tasks, Calendar, Files
- Relationships: CRM, Clients, Contacts, Client Portal
- Business: Finance, Invoices, Contracts, Reports
- Intelligence: AI Assistant, Analytics, Notifications
- Admin: Team, Integrations, Billing, Settings, Admin Panel

Object relationships:
- Client connects to projects, contacts, invoices, contracts, files, messages.
- Project connects to tasks, campaign, client, files, approvals, invoices, team.
- Invoice connects to client, project, contract, payment events.
- Contract connects to client, project, signatures, approval trail.
- Notification connects to a source object and action.
- AI insight always links to source records.

## Page Template Patterns

Marketing template:
- Sticky nav.
- Hero.
- Proof strip.
- Product story sections.
- Screenshot and workflow.
- Testimonials.
- Pricing preview.
- Security.
- FAQ.
- Footer.

App index template:
- Page header.
- Filter/saved view bar.
- KPI or summary strip.
- Primary data surface.
- Right context rail when useful.

Object detail template:
- Breadcrumbs.
- Object header with primary actions.
- Main timeline/work area.
- Right metadata rail.
- Related records tabs.

Create/edit template:
- Drawer by default.
- Header with object name.
- Sections with progressive disclosure.
- Sticky footer actions.
- Inline validation.

Admin template:
- Risk summary.
- Search/filter.
- Data table.
- Audit trail.
- Confirmation modals for high-impact actions.

## Component State Matrix

All controls:
- Default: clear affordance, no visual noise.
- Hover: color/border/background only.
- Focus: visible focus ring.
- Active: slight pressed feedback.
- Disabled: dimmed but readable.
- Error: semantic color plus icon and copy.

Tables:
- Empty: illustration, copy, CTA.
- Loading: skeleton rows.
- Error: retry panel with reason.
- Selected: checkbox state plus bulk bar.
- Filtered empty: "No results match these filters" plus reset.

Forms:
- Dirty: sticky unsaved bar.
- Saving: inline "Saving..." and disabled submit only when needed.
- Saved: toast and subtle field confirmation.
- Error: summary at top and field-level message.

AI:
- Thinking: contextual skeleton message, not only spinner.
- Drafted: edit controls visible.
- Applied: toast with undo where possible.
- Failed: source-aware recovery copy.

## Advanced Filtering UX

TASKIT uses a consistent filter model:
- Simple filters are chips above the data surface.
- Advanced filters live in a right drawer.
- Saved views are tabs or dropdown depending on count.
- Active filters always show count and "Reset all".
- Filter state persists in URL for shareability.
- Power users can save column order, density, sort, and filters.

## Data Density Modes

Comfortable:
- 48px table rows.
- 24px card padding.
- More helper text.

Compact:
- 40px table rows.
- 16px card padding.
- Helper text hidden unless focused.

Dense:
- 36px table rows.
- Used only for saved admin/reporting views.
- Requires accessible row focus and adequate hit targets for row actions.

## Responsive Rules

At 1024px:
- Right rails may collapse below main content.
- Chart grids move from 3 columns to 2.

At 768px:
- Sidebar becomes icon rail.
- Complex topbar actions move to create/help/avatar menus.
- Drawers widen to 90vw.

At 375px:
- Bottom nav replaces sidebar.
- Tables become cards.
- Filters become bottom sheet.
- Drawers and modals become full-screen sheets.
- Sticky footer actions appear for long forms.

## Interaction Rules

Hover:
- Border or background feedback in 100ms.
- No layout shift.

Click:
- Immediate visual response.
- Optimistic update where failure can be reversed.
- Toast confirms background actions.

Scroll:
- Topbar remains sticky.
- Page header may compress on data-heavy pages.
- Bulk action bars stay fixed near bottom.

Drag:
- Use lifted card shadow and visible drop slot.
- Support keyboard equivalent.

Inline edit:
- Click field, edit in place.
- Enter saves.
- Esc cancels.
- Blur saves only for low-risk fields.

## Marketing Screenshot Standard

Every screenshot must show real-looking product content:
- Client names should be plausible but fictional.
- Metrics should be internally consistent.
- No meaningless big numbers.
- Every chart must have labels.
- Empty states are acceptable when telling a setup story.
- Avoid showing personal data that looks real.

## Trust And Security UX

Security should be findable within two clicks:
- Marketing footer has Security, Privacy, Terms, DPA.
- Help center has Security category and status link.
- App topbar help menu links to Security and Status.
- Settings has Security and Audit sections.

Trust signals:
- SOC 2, GDPR, encryption, uptime, audit logs, role-based access, data retention, AI data policy.
- AI copy: "Your workspace data is not used to train shared models."
- Audit logs on finance, contracts, admin, and approvals.

## Accessibility Checklist

Global:
- Contrast >= 4.5:1 for normal text.
- Focus visible on every interactive element.
- Keyboard paths for every workflow.
- No color-only meaning.
- Reduced motion supported.
- Screen-reader labels on icon-only buttons.

Per-module:
- Dashboard charts include text summaries.
- CRM tables use aria-sort and row selection labels.
- Kanban supports keyboard reorder.
- Calendar has agenda list equivalent.
- File upload has button alternative.
- Modals/drawers trap focus and close with Esc.
- Toasts use status/alert live regions.
- AI responses identify generated content and source records.

## UX Quality Bar

Investor demo test:
- Landing page explains value in first viewport.
- Dashboard screenshot looks plausible and connected.
- Security and customer proof are visible.

New user test:
- User can sign up, pick modules, import or skip, invite team, and create first project or client within 5 minutes.

Power user test:
- User can filter, bulk edit, save views, use command palette, customize columns, and navigate by keyboard.

Trust test:
- Security-conscious buyer can find SOC 2, encryption, privacy, AI data policy, and status within two clicks.

Production launch test:
- No blank states.
- No placeholder-as-label fields.
- No inconsistent radius, color, or iconography.
- No marketing-only screens that fail as real software.
