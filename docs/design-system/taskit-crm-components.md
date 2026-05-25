# TASKIT CRM Component System

## Naming And Structure

Use Atomic Design with implementation folders under `src/components/crm/`.

```text
src/components/crm/
  atoms/
    Button/
    IconButton/
    Input/
    Checkbox/
    Radio/
    Toggle/
    Badge/
    Avatar/
    Skeleton/
  molecules/
    Field/
    SearchInput/
    FilterChip/
    StatCard/
    DealCard/
    Toast/
    Tooltip/
    Breadcrumbs/
    Tabs/
  organisms/
    Sidebar/
    Topbar/
    DataTable/
    KanbanBoard/
    ActivityFeed/
    Modal/
    Drawer/
    EmptyState/
  templates/
    AppShell/
    AuthSplit/
    SettingsShell/
    DetailShell/
  pages/
    LandingPage/
    PricingPage/
    DashboardPage/
```

Class names use `taskit-` plus category and component: `taskit-button`, `taskit-table`, `taskit-deal-card`. Variants use data attributes: `data-variant="primary"`, `data-size="md"`, `data-state="error"`.

## Buttons

Primary button: 36px height, 16px horizontal padding, `--radius-md`, brand background, white text. Use only for the highest-priority action on the current surface.

States:
- Default: `background: --color-brand`, `color: white`.
- Hover: `background: --color-brand-hover`.
- Focus: `box-shadow: 0 0 0 3px rgba(37,99,235,0.2)`.
- Active: `transform: translateY(1px)`, no layout shift.
- Disabled: `opacity: .45`, cursor not-allowed.
- Error: destructive variant, error text and alert icon.

Loading locks width using the last measured width. Spinner replaces the label and keeps `aria-busy="true"`.

Secondary is transparent with border. Ghost is transparent brand text. Destructive uses `rgba(239,68,68,.1)` background and `rgba(239,68,68,.3)` border. Icon-only is 36px by 36px with an `aria-label`.

## Inputs And Form Controls

All fields use a visible label above the input. Input height is 40px, background `--color-surface`, border `--color-border`, radius `--radius-md`, 12px horizontal padding.

States:
- Default: muted border, primary text.
- Hover: border becomes `color-mix(in srgb, --color-border 70%, --color-text-muted)`.
- Focus: brand border plus `0 0 0 3px rgba(37,99,235,.2)`.
- Active: cursor and text caret visible, no transform.
- Disabled: dim text, surface at 60% opacity.
- Error: error border, 12px error message below with `ExclamationCircleIcon`.

Checkbox is 16px by 16px, radius 4px, checked brand fill. Radio is 16px circle. Toggle is 40px by 22px with 18px thumb. Form label gap is always 8px.

## Badges And Status

Badges are semantic, never decorative. Small badges are 20px high, medium badges are 24px high, both use radius pill. Variants: success, warning, error, info, neutral, and pipeline stage. Each badge pairs color with text and, where useful, an icon.

Pipeline stage tokens:
- Lead: info.
- Qualified: brand.
- Proposal: warning.
- Negotiation: purple token.
- Won: success.
- Lost: error.

## Cards

Flat cards use surface, border, radius-lg. Elevated cards use surface-2, shadow-md, radius-lg. Interactive cards add hover border brand at 50% and cursor pointer. No card hover changes size.

Stat card anatomy: label, metric, delta, optional sparkline. Deal card anatomy: company name, contact, value, stage badge, close date, owner avatar, last activity. Deal cards are draggable with keyboard reorder support.

## Navigation

Sidebar is 240px wide, surface background, right border. Items are 40px high with 16px left padding, 8px icon gap, and radius-md. Active state uses brand at 10% opacity and brand text. Collapsed sidebar is 64px, icon-only, tooltip on hover and focus.

Topbar is 64px high with center command search, notification bell, help, avatar menu. Breadcrumbs use 12px text, chevron separators, muted ancestors, primary current page. Tabs are 40px high with 2px active underline.

## Data Table

Header labels are 12px uppercase, 500 weight, muted text. Rows are 48px high with bottom border. Checkbox column is 48px. Hover changes background to surface-2. Loading uses skeleton rows matching the final row height.

Features: sortable headers, column resizing, column reordering, filter chips, right filter drawer, bulk action bar, pagination with prev and next context, empty state with CTA.

## Modals, Drawers, Popovers, Tooltips

Modal overlay is `rgba(0,0,0,.7)`. Modal width is 560px, max-width `calc(100vw - 32px)`, surface-2, radius-lg, shadow-lg. Header has h3 and close icon. Footer has secondary action on the left and primary/destructive actions right-aligned. Esc closes the modal.

Drawer width is 480px desktop and full-width mobile. Popovers use surface-2 and shadow-md. Tooltips appear after 350ms, use 12px text, and are keyboard reachable through focus.

## Empty, Loading, Toasts

Empty state includes a minimal Heroicons-style SVG illustration, h3 heading, body copy, and primary CTA. Skeletons match real dimensions and use shimmer. Toasts sit bottom-right, 320px wide, stack up to 3, and auto-dismiss after 4 seconds. Each toast uses a semantic left border and close button.

## Animation Spec

Default micro-interaction: 150ms ease-out. Drawer: 220ms ease-out slide. Modal: 150ms ease-out scale .96 to 1 plus opacity. Toast: 150ms translateY(8px) to 0. Skeleton shimmer: 1.2s linear infinite. Respect `prefers-reduced-motion`.

## Icon Inventory

Use Heroicons outline only:
HomeIcon, CurrencyDollarIcon, UserGroupIcon, BuildingOfficeIcon, CalendarDaysIcon, ChartBarIcon, TrophyIcon, Cog6ToothIcon, CreditCardIcon, BellIcon, QuestionMarkCircleIcon, MagnifyingGlassIcon, PlusIcon, FunnelIcon, AdjustmentsHorizontalIcon, ChevronRightIcon, ChevronDownIcon, ArrowDownTrayIcon, EnvelopeIcon, PhoneIcon, PencilSquareIcon, ClockIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, InformationCircleIcon, ShieldCheckIcon, LockClosedIcon, DocumentTextIcon, SparklesIcon, PlayCircleIcon, XMarkIcon, EllipsisHorizontalIcon.
