# TASKIT OS Premium Design System

TASKIT is an all-in-one operations OS for agencies and service businesses. This system treats TASKIT as a serious work surface: fast, dense, calm, and trustworthy. The design direction is premium enterprise SaaS: Linear-level restraint, Stripe-level trust, Notion-level clarity, and Salesforce-level operational depth.

## Product UX Strategy

TASKIT must help a team move from "what is happening?" to "what should I do next?" in as few steps as possible. The UI should not compete with the work. It should prioritize next actions, surface operational risk early, and make every module feel connected.

Primary UX principles:
- One operating model: every module uses the same shell, object header, table, drawer, empty state, and action grammar.
- Progressive density: new users see guided defaults; power users can expand filters, columns, bulk actions, keyboard commands, and saved views.
- Trust by evidence: security, audit history, ownership, timestamps, and data provenance are visible where decisions happen.
- AI as an assistant, not a theme: AI appears as contextual recommendations, summaries, drafts, and explanations. It is not a decorative mascot.
- No dead ends: every object links to the next logical object, such as client to project, invoice to contract, notification to task, and insight to report.

## Brand Identity

Personality: professional, smart, reliable, fast, innovative, and operationally excellent. TASKIT should feel like a command center for service businesses, not a task app with enterprise paint.

Brand system:
- Primary brand color: electric blue, reserved for primary action, active state, focus, and current selection.
- Base: deep navy for a premium, low-fatigue working environment.
- Surfaces: layered navy panels with restrained borders. Elevation is used for overlays and active work areas, not for decoration.
- Type: Inter for all UI and data. Sora for hero display and major page titles only.
- Iconography: one outline icon set. Use consistent 1.75px to 2px stroke, 20px default app icons, 24px marketing feature icons.
- Radius: 8px is the default. 12px for cards and modals. Pill only for badges, avatars, and compact status controls.

## Grid And Layout

Marketing pages:
- Desktop: 1440px canvas, 1200px max content, 12 columns, 24px gutters, 80px side margins.
- Tablet: 768px, 8 columns, 32px side margins.
- Mobile: 375px, 4 columns, 20px side margins.

App shell:
- Sidebar: 248px desktop, 72px compact, bottom nav on mobile.
- Topbar: 64px, sticky, search-centered where space allows.
- Main content: 32px desktop padding, 24px tablet, 20px mobile.
- Detail pages: 70/30 content split on desktop, stacked on mobile.
- Tables: 48px rows, 40px compact rows optional for dense saved views.

Spacing logic:
- 4px: icon optical alignment and micro gaps.
- 8px: controls, labels, compact groups.
- 16px: field groups, row content, card internals.
- 24px: card padding, form sections, grid gaps.
- 32px: page header to content, major app sections.
- 48px: marketing section internals and page group breaks.
- 64px, 96px, 128px: marketing rhythm only.

## Typography System

Hero: Sora 56/1.02, 700, -0.035em. Used only on landing hero.  
Display: Sora 40/1.1, 700, -0.025em. Used on marketing sections and major onboarding moments.  
H1: Inter 30/1.18, 650, -0.02em. Used for app page titles.  
H2: Inter 22/1.28, 650, -0.012em. Used for section titles.  
H3: Inter 17/1.35, 600. Used for cards and modal titles.  
Body: Inter 14/1.6, 400. Used for most product copy.  
Label: Inter 12/1.35, 600, 0.04em. Uppercase labels use 0.08em.  
Caption: Inter 11/1.45, 450. Used for timestamps and metadata.  
Code: JetBrains Mono 13/1.55. Used for API keys, IDs, and webhook snippets.

Typography does the hierarchy work. Color should almost never be needed to make text feel important.

## Color And Elevation Philosophy

TASKIT uses a dark-first palette with light mode parity. The color system has three layers:
- Brand and selection: blue only.
- Semantic meaning: success, warning, danger, info.
- Product taxonomy: used sparingly with an icon and label for modules, charts, and filtering.

Do not use random colors for cards. Do not introduce gradients except one optional controlled landing hero highlight. Shadows are reserved for overlays, floating bars, popovers, and actively manipulated objects.

## Component Philosophy

Components are built for repetition and long sessions:
- Controls have predictable heights: 32, 40, 48.
- Tables, feeds, boards, and lists share selection, sorting, filtering, bulk action, loading, and empty state behavior.
- Drawers are the default create/edit surface. Modals are for confirmations, focused tasks, and blocking decisions.
- Command palette is the fastest global path.
- Context menus reveal secondary actions without crowding primary workflows.

## Core Components

Buttons:
- Primary: brand background, white text, 40px app height, 48px marketing hero height.
- Secondary: transparent surface, border, primary text.
- Ghost: transparent, muted or brand text depending on hierarchy.
- Destructive: danger text, danger-soft background, danger border.
- Icon-only: square, 40px app default, tooltip on hover/focus.
- Loading: width locked, spinner replaces content.

Forms:
- Every field has a visible label.
- Error copy explains how to recover.
- Field help text sits below input, not inside placeholder.
- Password and API fields include reveal/copy controls.
- Long forms use sections, sticky footer actions, and autosave indicators when appropriate.

Tables:
- Header labels: uppercase, 12px, muted.
- Rows: 48px, border-bottom, hover surface-raised.
- Bulk action bar: bottom, 56px high, appears after selection.
- Filtering: chips above table, advanced drawer, saved views.
- Empty: illustration, specific copy, primary CTA.
- Loading: skeleton rows identical to final dimensions.

Cards:
- Flat cards for repeated content.
- Elevated cards for overlays or current focus.
- Interactive cards use border change only, no layout movement.
- Stat cards always show label, value, context, and delta.

Navigation:
- Sidebar supports groups, active state, collapsed state, workspace switcher, and status.
- Topbar hosts command search, notifications, help, and avatar menu.
- Breadcrumbs appear on object/detail pages.
- Tabs are underline style for same-object subviews.

Overlays:
- Drawer: 480px desktop, full-screen mobile, used for create/edit.
- Modal: 560px, blocking decisions and compact workflows.
- Popover: contextual controls, never complex forms.
- Tooltip: short labels and icon clarification.

AI Assistant:
- Global assistant opens as a right panel.
- Contextual AI cards appear inside modules with source links and clear action buttons.
- AI output must disclose data source and freshness.
- User can accept, edit, or dismiss AI recommendations.

## Motion Direction

Motion is functional. Default duration is 150ms ease-out. It confirms cause and effect but never performs for decoration.

Motion rules:
- Hover: 100ms color/border/background only.
- Drawer: 280ms slide from right with opacity.
- Modal: 150ms scale .96 to 1 plus opacity.
- Toast: 150ms translateY(8px) to 0.
- Command palette: 150ms opacity plus 8px translate.
- Kanban drag: lifted card shadow, static layout slot.
- Skeleton shimmer: 1.2s, disabled in reduced motion.

## Accessibility Standards

- WCAG 2.1 AA minimum.
- Visible focus ring for every interactive element.
- Keyboard support for nav, tables, modals, drawers, dropdowns, command palette, kanban drag, file upload, and inline edit.
- No color-only meaning. Pair state with icon, label, shape, or text.
- Tables expose sort state and row selection to assistive tech.
- Modals and drawers trap focus and close with Esc.
- Toasts use appropriate live regions.
- Charts provide summary tables or accessible text equivalents.

## Data Visualization

Charts should look like business instruments, not illustrations. Use muted grids, direct labels, and restrained color. Use chart color only for category separation or semantic state. Always include exact numbers near visual summaries.

Chart types:
- Dashboard: bar, line, compact KPI sparklines.
- Analytics: line, stacked bar, cohort table, funnel, leaderboard.
- Finance: revenue line, invoice aging bars, margin cards.
- Operations: workload heatmap, SLA bar, calendar density.

## Empty States

Every empty state has:
- Minimal line illustration using the app icon language.
- One specific heading.
- One practical sentence.
- Primary CTA.
- Optional secondary link to docs/import.

Examples:
- "No projects yet. Create a project to connect tasks, files, invoices, and client updates."
- "No invoices match these filters. Clear filters or create a new invoice."
- "Your notification center is clear. New mentions, approvals, and deadline changes will appear here."

## Loading And Latency

Never show a blank spinner without context. Use skeletons for initial content, optimistic UI for create/update, inline save states for forms, and toasts for asynchronous confirmation. If a module cannot load, show the last cached data with a warning when possible.

## Content Voice

TASKIT speaks like a competent operations lead: direct, calm, precise. Avoid hype inside the product. Marketing can be confident, but product copy should be task-focused.

Good:
- "Create invoice"
- "Send for approval"
- "3 tasks are blocked"
- "This forecast uses invoices updated 12 minutes ago"

Avoid:
- "Supercharge your productivity"
- "Unleash your team's potential"
- "Oopsie"
- "Magic AI"

## Implementation Contract

Use this system as the target for redesigning existing TASKIT modules. Build shared primitives first: tokens, shell, buttons, fields, cards, tables, drawers, modals, empty states, toasts, command palette. Then migrate page modules one route group at a time.
