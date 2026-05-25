# TASKIT CRM Redesign

Product: TASKIT  
Category: CRM / Sales SaaS  
Tagline: Close more deals. Less noise.  
Target: sales reps, account managers, and SDRs at B2B companies with 10 to 500 employees.

## Design Direction

TASKIT uses a Salesforce Lightning-inspired enterprise structure with Linear-level restraint. The interface is dense enough for power users, but hierarchy comes from typography, alignment, and spacing rather than decorative color. The base is dark navy, not black, to keep long sessions comfortable. Electric blue is reserved for primary actions, focus states, active navigation, and current pipeline emphasis.

Grid: 12 columns at 1440px, 80px page margins, 24px gutters, 1200px max content for marketing pages. App shell: 240px sidebar, 64px topbar, main content starts at x=240 and y=64. Tablet breakpoint: 768px. Mobile target: 375px minimum.

References: Salesforce Lightning for component density, navigation structure, and accessibility discipline; Linear for spacing restraint and typographic hierarchy.

## Global Component States

Every interactive component supports default, hover, focus, active, disabled, and error where applicable. Focus is always visible with brand outline plus 3px translucent ring. Hover never shifts layout. Loading states preserve final content dimensions. Empty states exist for every feed, table, board, and list.

## Screen 01: Landing Page

Desktop layout at 1440px:
- Sticky nav: 64px high, 80px side padding, logo left 112px wide, center links 32px gap, right actions 12px gap. Blur activates after 24px scroll.
- Hero: 1200px max width, top padding 96px, bottom 64px, 12-column grid. Left spans 5 columns, right spans 7. Headline max 8 words: "Close more deals. Less noise." Subtext max 2 lines: "TASKIT gives sales teams one focused workspace for pipeline, contacts, activity, and forecasting." CTA row 16px gap.
- Product mockup: 680x440px, surface-2, 1px border, radius-xl, shows sidebar, stats, chart, and deals table with real CRM data.
- Social proof: 56px high bar, 6 grayscale logo lockups, copy "Trusted by 2,400+ sales teams."
- Features: 3 columns, 24px gap, cards 184px high. Features: Pipeline visibility, Email sequences, AI deal scoring, Team performance, Mobile-first, SOC 2 compliant.
- Screenshot band: 1200x640px mock dashboard, caption below.
- Testimonials: 3 cards, each 368px wide, quote max 2 lines, initials avatar.
- Pricing preview: 3 cards, 24px gap, "See full pricing ->".
- Security: 4 badge row, uptime pill, "Your data never trains our models."
- Footer: 4 columns, 32px gap, bottom bar with theme toggle.

Components: nav, button, ghost button, product mockup, logo lockup, feature card, testimonial card, pricing card, badge, chat widget, footer links. States shown: nav sticky, buttons hover/focus/loading, chat widget open/closed, theme toggle on/off.

Microcopy: Primary CTA "Start free - no credit card"; secondary "See a 3-min demo"; chat "Questions? Chat with us"; security "SOC 2 Type II", "GDPR", "256-bit encryption", "99.9% uptime SLA".

Interactions: nav links smooth-scroll. Primary CTA opens signup. Demo opens modal with Esc close. Chat opens bottom-right panel. Logo returns home. Theme toggle switches token theme. Product mockup has subtle 150ms hover border only.

Mobile 375px: nav logo plus menu button, links in drawer. Hero becomes single column with 24px side padding and 48px top spacing. Product mockup scales to 327px wide. Features stack. Testimonials become horizontal snap cards. Footer becomes accordion.

Rationale: The first viewport answers value, credibility, and action without scrolling. Product UI is the hero asset because CRM buyers need to inspect workflow reality. Blue appears only on CTA and active state, making conversion path unmistakable.

## Screen 02: Pricing Page

Desktop layout: 80px margins, 96px top spacing. Header spans 7 columns. Billing toggle 40px high below header. Cards row: 3 cards, each 384px wide, 32px internal padding. Growth card has brand border and "Most popular" badge. Comparison table starts 64px below cards, row height 48px, grouped sections with 40px section headers. FAQ accordion 6 items, each 56px closed. Cancellation policy callout 64px high. Bottom CTA band 320px high.

Components: billing toggle, pricing card, badge, comparison table, accordion, testimonial card, CTA band. States: toggle on/off, card hover/focus, accordion expanded/collapsed, CTA loading.

Microcopy: Starter "$29/seat/mo"; Growth "$69/seat/mo"; Enterprise "Custom"; policy "Cancel anytime. No contracts. No exit fees."; CTA "Start your 14-day free trial."

Interactions: monthly/annual updates prices with 150ms fade. Feature rows reveal tooltip on info icon. FAQ opens one item at a time. Enterprise CTA opens sales-contact drawer.

Mobile: cards stack, featured card first. Comparison becomes grouped cards. FAQ full width. CTA sticky bottom button appears after pricing cards.

Rationale: Pricing emphasizes predictability and removes contract anxiety. The comparison table supports procurement and power evaluators without burying the starting path.

## Screen 03: Sign In

Desktop layout: split 50/50. Left panel 720px, padding 80px, logo top, value prop centered vertically, testimonial at bottom. Right form panel max 420px, centered. Form fields 40px high, 16px vertical spacing. Submit button 36px high. OAuth row 2 equal buttons.

Components: auth split, field, password toggle, checkbox, banner alert, OAuth button, primary button. States: invalid email, incorrect password, loading disabled inputs, remember checked.

Microcopy: "Sign in to TASKIT"; "Incorrect email or password. Try again or reset your password."; "or continue with"; "Do not have an account? Start free ->".

Interactions: show/hide password toggles icon and aria-label. Submit validates inline. Forgot opens reset page. OAuth buttons start provider flow. Loading locks button width.

Mobile: left panel compresses to 132px brand header, form below with 24px padding. OAuth buttons stack.

Rationale: The split page adds reassurance without distracting from the form. Errors are direct and recovery-oriented.

## Screen 04: Sign Up

Desktop layout mirrors sign in. Right panel contains 2-step form. Progress label top: "Step 1 of 2", 4px progress bar. Step 1 fields: full name, work email, password, terms. Step 2 fields: company name, team size, role, source. No-card callout below CTA.

Components: stepper, field, password strength meter, checkbox, select, OAuth button, callout. States: password weak/fair/strong, terms error, email taken, loading.

Microcopy: "Create my account"; "Set up my workspace ->"; "No credit card required. Trial starts after your workspace is ready."

Interactions: Step 1 validates email and password before Step 2. OAuth bypasses Step 1 but still requests company setup. Terms link opens new tab.

Mobile: one-column with sticky progress top. Form inputs remain 40px. CTA full width.

Rationale: Progressive disclosure keeps signup fast. Asking for company details after account basics reduces initial friction.

## Screen 05: Onboarding Flow

Desktop layout: 960px centered card, 80px top padding. Progress bar has 3 segments, 8px gap, 6px height. Step content max 680px. Stage editor list rows 48px high, drag handle left, remove icon right. Import drop zone 100% width, 184px high. Invite rows 40px high.

Components: segmented progress, draggable list, CSV drop zone, email chip input, empty invite state, completion screen. States: drag, upload progress, CSV error, skipped, complete.

Microcopy: "Set up your pipeline"; "Import your contacts"; "Invite your team"; "Skip, I will add manually"; completion "Your workspace is ready!"

Interactions: drag reorder supports pointer and keyboard. Add stage appends focused input. Upload validates CSV headers. Invite "Add another" creates another row. Completion confetti respects reduced motion.

Mobile: full-screen flow, 24px padding, progress segments at top, drag list full width, bottom sticky back/continue bar.

Rationale: Onboarding collects only the configuration needed to make the first dashboard useful. Defaults let a rep finish in minutes.

## Screen 06: Dashboard

Desktop layout: sidebar 240px, topbar 64px. Main area padding 32px. Header row 48px high: greeting left, date filter right. Stat grid: 4 columns, 24px gap, cards 148px high. Main grid: left 8 columns pipeline chart, right 4 columns activity feed. Deals table below, 48px rows. Persistent "+ New deal" button in sidebar footer.

Components: app shell, sidebar, topbar search, notification bell, avatar menu, stat card, horizontal bar chart, activity feed, data table, quick-add button. States: sidebar active, notification unread, table sorting/loading/empty, chart hover.

Microcopy: "Good morning, Alex. You have 3 deals closing this week."; stats: Open Deals, Pipeline Value, Won This Month, Conversion Rate.

Interactions: Cmd+K opens command palette. Stat card click filters dashboard. Chart bar hover shows count and value. Table rows open deal detail. New deal opens drawer.

Mobile: sidebar becomes bottom nav, topbar search becomes icon. Stats become 2 columns. Table becomes deal card stack. Activity feed moves below table.

Rationale: The dashboard puts immediate sales risk first: closing deals, pipeline value, and recent signals. Reps can act from every section.

## Screen 07: Deals / Pipeline

Desktop layout: page header 56px, filters 40px, view toggle right. Kanban board: horizontal scroll, each column 288px wide, 16px gap, 72px header, cards 168px high. List view uses data table. New deal drawer 480px wide.

Components: filters bar, search, select filters, date range, kanban column, deal card, view toggle, drawer form. States: dragging, drop target, filter active, drawer validation, list loading.

Microcopy: "+ Add deal"; "Last activity 2h ago"; drawer CTA "Create deal"; empty column "No deals in Proposal yet."

Interactions: toggle changes view without losing filters. Drag updates stage optimistically and toasts success/error. Add deal opens drawer prefilled with column stage. Filters sync to URL.

Mobile: board becomes stage tabs with one column visible. List becomes cards. Drawer full screen.

Rationale: Kanban supports fast stage management, while list view supports audit and bulk operations. Both share the same filters to avoid mental reset.

## Screen 08: Contact Detail

Desktop layout: breadcrumb 24px high. Header 88px high with 48px avatar, h2, subtitle, badge, action buttons. Body grid: left 70%, right 30%, 24px gap. Timeline composer 120px high. Timeline items 72px min. Right cards stack with 16px gap.

Components: detail shell, avatar, badge, action buttons, note composer, timeline feed, info card, inline editable fields. States: editing, saving, save error, empty timeline.

Microcopy: "Add a note..."; "Email Maya"; "Schedule"; empty "No activity yet. Add a note to create the first touchpoint."

Interactions: Email opens compose modal. Call logs call. Inline fields enter edit on click, Enter saves, Esc cancels. Mention menu opens on @.

Mobile: header stacks, actions horizontal scroll, right cards move below timeline.

Rationale: Contact detail is built around the next best action. Timeline first supports account context before metadata.

## Screen 09: Company Detail

Desktop layout matches contact detail. Header has 56px logo placeholder, company name, industry badge, website, ARR, employee count. Left timeline 70%, right company info 30%.

Components: company header, timeline, contacts list, open deals card, custom fields, inline edit. States: website hover, missing logo, empty contacts, field error.

Microcopy: "Open website"; "ARR"; "Employees"; empty "No contacts linked yet. Add the first contact."

Interactions: website opens new tab. Contact item opens contact detail. Deal opens deal detail. ARR and employee count inline-edit.

Mobile: metadata turns into 2-column compact stats, right rail stacks.

Rationale: Matching the contact pattern reduces learning cost. Company-level commercial context is surfaced before notes.

## Screen 10: Activities

Desktop layout: header with quick-add buttons. View toggle calendar/list. Calendar week grid 7 columns, hour rows 56px. Activity chips use semantic type with icon and text. List view table row height 48px.

Components: week calendar, activity chip, quick-add buttons, list table, overdue badge, status filter. States: overdue, completed, drag reschedule, empty day.

Microcopy: "+ Schedule call"; "+ Send email"; "+ Add task"; overdue "Overdue by 2 days."

Interactions: click event opens detail popover. Drag reschedules optimistically. Quick-add opens modal with type preselected. List filters by status and owner.

Mobile: calendar becomes agenda list grouped by day. Quick-add buttons become split menu.

Rationale: Sales activities need temporal clarity. The calendar is primary, while list view is for operational cleanup.

## Screen 11: Notifications

Desktop layout: 840px content column, 32px padding. Header with "Mark all read" and type filter. Groups: Today, This week, Earlier. Notification rows 64px high with icon/avatar, copy, entity link, timestamp, mark-read button.

Components: notification list, group headers, filter select, bulk action, empty state. States: unread, read, hover, mark read loading, empty.

Microcopy: "You are all caught up. No new notifications."; "Maya Chen mentioned you on Northstar renewal."

Interactions: click row opens linked entity. Mark read fades row to read state. Mark all read confirms if more than 20 unread.

Mobile: rows become 1-column cards, filters collapse into drawer.

Rationale: A full page lets users triage beyond a dropdown. Grouping by time keeps scanning natural.

## Screen 12: Profile And Settings

Desktop layout: settings shell with 240px left settings nav and main content 720px. Sections: Profile, Security, Notifications, Integrations, API, Team, Billing. Profile card includes avatar upload, display name, email, timezone, language, theme. Security has password, 2FA, sessions. Notifications has granular toggles.

Components: settings nav, avatar uploader, fields, select, toggle, session list, 2FA setup card. States: upload drag, dirty form, saved toast, revoke confirmation, 2FA active.

Microcopy: "Changes saved"; "Revoke session"; "Require a code when signing in."

Interactions: nav anchors scroll and update URL hash. Avatar supports drag or click. Theme toggle updates immediately. Session revoke opens confirm modal.

Mobile: settings nav becomes horizontal tabs. Forms full width. Session list cards.

Rationale: Settings are grouped by user intent, not data model. Security and billing are always one click from the left nav.

## Screen 13: Billing

Desktop layout: content 960px. Current plan card 100% width, 148px high. Payment method and upgrade CTA in 2-column grid. Invoice history table below with 48px rows. Cancel subscription tertiary link bottom.

Components: plan card, payment method card, invoice table, upgrade CTA, cancel modal, retention offer. States: card expired, invoice paid/pending/failed, cancel confirmation, upgrade loading.

Microcopy: "Unlock growth features ->"; "Cancel subscription"; modal "Before you go, want to pause seats instead?"

Interactions: update card opens billing portal. Download PDF starts file download. Cancel opens modal with Esc close and visible X. Upgrade opens pricing checkout.

Mobile: cards stack. Invoice table becomes downloadable invoice cards.

Rationale: Billing is transparent and calm. Destructive cancellation is available but deliberately low emphasis.

## Screen 14: Help Center

Desktop layout: search hero 360px high, content max 1120px. Search input 56px high. Category cards 3 columns, 24px gap. Featured articles 4 cards. Contact support section 3 columns. Status link in header and support section.

Components: search hero, category card, article card, support option, status pill, chat trigger. States: search focused, no results, category hover, chat open.

Microcopy: "How can we help you?"; "All systems operational"; "Still need help?"; "Chat - open now"; "Schedule a call."

Interactions: search filters articles live after 2 characters. Enter opens results page. Chat opens widget. Status opens status page. Category cards open article lists.

Mobile: search hero 240px, cards stack, featured articles list.

Rationale: Help begins with search, then offers structured paths and human support. Uptime is visible for trust-sensitive buyers.

## Global Accessibility Checklist

- Contrast target is WCAG 2.1 AA: text at least 4.5:1, large text at least 3:1.
- All icons are either `aria-hidden="true"` when decorative or have explicit `aria-label`.
- Keyboard order follows visual order.
- Esc closes modal, drawer, popover, command palette, and menu surfaces.
- Focus trap applies inside modal and drawer.
- Tables expose sortable state with `aria-sort`.
- Kanban drag supports keyboard movement and screen-reader announcements.
- Toasts use `role="status"` for success/info and `role="alert"` for error.
- No information relies on color alone; badges include text and icons where needed.

## Trust Path

From any screen, users can reach security information within 2 clicks: Help/Question icon -> Security category, or footer Legal/Security links on marketing pages. Landing and pricing both show SOC 2, GDPR, encryption, uptime, cancellation policy, testimonials, and support access.
