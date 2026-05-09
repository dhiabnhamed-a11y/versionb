# Creative Operations Hierarchy

Canonical hierarchy:

```txt
Workspace(Company)
-> Client
-> Campaign
-> Brief
-> Deliverable
-> Task
-> Subtask
```

## Entity Mapping

- `Company` remains the workspace/tenant boundary.
- `Project` is deprecated in product language and now acts as the migration-phase campaign backing model.
- `Brief` is the planning unit inside a campaign. New task creation creates or uses a brief before work is created.
- `Deliverable` is the required parent for tasks and owns files, revisions, approvals, invoice links, and activity.
- `Task` is execution work under a deliverable. It keeps `projectId` as a compatibility campaign pointer during migration, but canonical ownership is `deliverableId`.
- `Subtask` is nested work under a task.

## Migration Strategy

Migration `20260509143000_creative_operations_hierarchy` is additive and data-preserving:

- Existing `Project` rows remain campaign records.
- Every campaign receives an imported `Brief`.
- Every existing `Task` receives a generated `Deliverable`, preserving title, description, type, stage, deadline, timestamps, and approval-equivalent state.
- `Task.deliverableId` is backfilled and then made required.
- Existing task submissions continue to work; new uploads also create `DeliverableFile` and `DeliverableRevision` records.
- Default recurring video workflow templates are seeded as `Script -> Edit -> Review -> Subtitles -> Export`.

## Workflow Rules

- Tasks cannot be created without a deliverable. Legacy callers may send `projectId`; the API creates a deliverable under the campaign's imported brief.
- Dependencies are stored in `TaskDependency`; a task cannot move to `IN_PROGRESS` while a dependency is not done and approved.
- Deliverables use `INTERNAL_REVIEW`, `CLIENT_REVIEW`, `APPROVED`, and `DELIVERED`.
- Approval state is separate from progress: `PENDING`, `CHANGES_REQUESTED`, `APPROVED`.
- Delivery is blocked until approval is complete.

## Compatibility Routes

- Canonical new routes: `/api/briefs`, `/api/deliverables`, `/api/campaigns`.
- Legacy routes `/api/projects` and `/api/tasks` remain available during migration.
- Frontend project screens are still compatibility screens and should be renamed to campaigns in the next UI pass.

## Breaking Changes

- `Task.deliverableId` is now required.
- New task writers must send `deliverableId`, or use the migration fallback with `projectId`.
- Direct completion semantics changed: deliverable approval state determines whether work is truly complete/deliverable.
- Invoice items can now link directly to deliverables via `InvoiceItem.deliverableId`.
