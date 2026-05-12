# TASKIT Dashboard Redesign Migration Checklist

Use this checklist when moving the overview redesign patterns into the rest of the platform.

1. Inventory every visible string on the page and move it into `src/lib/i18n.ts`.
2. Replace company-type labels with `getLocalizedCompanyCopy(...)` instead of raw `getCompanyTypeCopy(...)`.
3. Enforce one primary CTA per route; demote secondary actions to `taskit-secondary-action`.
4. Apply the four type roles only: Display, Heading, Label, Body.
5. Keep card padding at `--space-card` and section spacing at `--space-section`.
6. Group dense KPI sets into collapsed clusters before showing individual rows.
7. Move assistant or agent detail panels behind a drawer, modal, or disclosure if they are not the main task.
8. Add a tooltip or helper disclosure to any score that is not self-evident.
9. Localize chart labels, table statuses, role names, empty states, and action labels.
10. Verify dark mode by relying on design tokens and existing workspace theme variables.
11. Run `npx tsc --noEmit --pretty false` after each page migration.
12. Run `npm run lint` and confirm new work adds no errors.
