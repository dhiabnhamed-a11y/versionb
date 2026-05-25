# TASKIT Workspace Architecture

TASKIT now treats `Company.companyType` as the canonical workspace selector. Routing, onboarding, provisioning, navigation, API access, and AI context must derive from that value through `src/lib/workspace-routing.ts`.

## Canonical Workspace Contract

Each company type maps to a `WorkspaceBlueprint`:

- `surface`: product experience family (`standard`, `agency`, `enterprise`, `healthcare`, `erp`)
- `homePath`: deterministic landing path after login
- `shell`: frontend shell that must render the workspace
- `modules`: allowed module graph for navigation and AI context
- `aiContext`: persona and operational priorities for assistant behavior

ERP is a dedicated product surface. `ERP_WORKSPACE` always resolves to `/erp` and uses `ERPShell`; it must never render `/dashboard/admin` or `/dashboard/employee`.

## Routing Guarantees

The same resolver is used in four places:

- `src/app/dashboard/page.tsx`: post-login and generic dashboard landing
- `src/proxy.ts`: request-level route correction before render
- `src/app/dashboard/admin/layout.tsx`: server-side dashboard admin guard
- `src/app/dashboard/employee/layout.tsx`: server-side employee guard

Important invariants:

- ERP users entering `/dashboard`, `/dashboard/admin`, or `/dashboard/employee` are redirected to `/erp`.
- ERP profile/settings requests use ERP shell paths: `/erp/profile` and `/erp/settings`.
- Non-ERP users entering `/erp` are redirected to their canonical workspace home.
- Employees cannot enter manager/admin dashboard surfaces.
- Super admins resolve to `/dashboard/super-admin`.

## Provisioning Guarantees

Owner signup calls `provisionWorkspaceForCompany` inside the signup transaction after the company and owner are created.

Provisioning responsibilities:

- Enterprise, healthcare, and IT workspaces create enterprise departments, teams, SLA policies, asset categories, approval workflows, role assignments, and audit events.
- ERP workspaces create the fiscal year, periods, standard chart of accounts, ERP settings, and setup progress before the user first enters `/erp`.
- Every provisioning run writes a workspace audit log with the selected shell, surface, modules, AI context, and initialized subsystems.

## API Isolation

Authenticated API routes are checked through `getWorkspaceApiAccessError` in the shared API handler.

Current enforced boundaries:

- `/api/v1/erp2/*` requires `ERP_WORKSPACE`.
- `/api/enterprise/*` requires enterprise, healthcare, clinic/hospital, or corporate IT operations.
- healthcare admin APIs require healthcare workspace types.

## Onboarding Integrity

Workspace type parsing accepts canonical slugs and enum-style query values:

- `erp-workspace`
- `erp_workspace`
- `ERP_WORKSPACE`

Signup emits canonical slugs through `getCompanyTypeSlug`, so a selected ERP workspace cannot silently downgrade to `OTHER`.

## AI Context

`/api/ai/workflow-context` returns:

- `companyType`
- `workspaceSurface`
- `workspaceModules`
- `aiContext`

Assistant tools can use this to adapt recommendations and hide irrelevant workflows for the active workspace.
