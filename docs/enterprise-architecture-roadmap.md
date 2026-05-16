# TASKIT Enterprise Architecture Migration Roadmap

Updated: 2026-05-16

## Current Audit Snapshot

- API surface: 99 App Router API route files.
- Canonical `/api/v1` surface: 7 route files.
- Legacy API surface: 92 route files.
- Routes returning raw `NextResponse.json`: 49 route files.
- Routes with direct database/query logic in handlers: 28 route files.
- Strong existing primitives: modular domain modules, Prisma/PostgreSQL, canonical API helpers, workers, Redis-aware realtime, durable job/audit records, finance and AI service modules.
- Primary weakness: uneven adoption. Several enterprise primitives exist, but legacy routes still bypass them.

## Priority 0: Safety Rails

1. Keep legacy routes operational while adding `/api/v1` aliases.
2. Migrate one domain slice at a time: route facade, DTO/schema, service, repository, tests, OpenAPI metadata.
3. Treat database migrations as additive until usage is proven.
4. Gate risky behavior behind production checks and explicit environment verification.

## Priority 1: API Platform Hardening

1. Make `/api/v1` canonical for high-risk domains first: finance, invoices, contracts, AI actions, integrations, media uploads, workflows.
2. Move route-owned Prisma/business logic from legacy route handlers into services and repositories.
3. Require canonical envelopes on all `/api/v1` endpoints: `success`, `data`, `meta`, `requestId`, `timestamp`, `error`.
4. Complete durable idempotency adoption for all replay-risk writes: finance posting, invoices, payments, contract generation, uploads, webhooks, and AI actions.
5. Replace the manually assembled OpenAPI spec with generated route metadata from Zod schemas and DTO definitions.
6. Generate typed SDKs from the governed OpenAPI artifact after route metadata is reliable.
7. Add API lifecycle controls: deprecation headers, sunset policy, changelog, slow endpoint scoring, and route-level metrics.

## Priority 2: Realtime Hardening

1. Require Redis for realtime in production startup.
2. Continue removing process-memory assumptions from presence and socket governance.
3. Persist realtime events with replay offsets, cursors, acknowledgement state, and missed-event replay.
4. Move delivery and replay into dedicated realtime workers.
5. Add per-tenant socket rate limits, payload validation, auth refresh, and socket health metrics.

## Priority 3: Security Hardening

1. Enforce tenant scope in every repository query, cache key, event, socket room, and idempotency key.
2. Reject invalid webhooks before persistence or queueing.
3. Replace rank-style RBAC with a permission matrix covering finance, AI, workflows, contracts, and custom roles.
4. Add enterprise auth controls: MFA/TOTP, device history, session revocation, suspicious login detection.
5. Harden uploads with signed policies, MIME/content validation, malware-scan hooks, and temporary access URLs.
6. Expand immutable audit coverage to all mutations, exports, approvals, AI actions, finance operations, and permission changes.

## Priority 4: Operations And Scalability

1. Separate web runtime, general workers, AI workers, media workers, and realtime workers operationally.
2. Move heavy operations async: AI, PDFs, media processing, reports, contract generation, and exports.
3. Add OpenTelemetry instrumentation, Prometheus-compatible metrics, and queue/socket/AI/finance/tenant dashboards.
4. Build load tests for API, realtime, AI concurrency, finance transaction volume, and tenant isolation.

## Priority 5: Enterprise Controls

1. Add tenant admin controls, API tokens, audit export, quota management, and retention policies.
2. Add SAML SSO and SCIM after the permission model is stable.
3. Add backup/restore tooling, legal hold, disaster recovery runbooks, and SLA monitoring.

## Weak Route Cohorts To Migrate First

- Finance legacy routes: direct business operations and accounting side effects deserve first-class `/api/v1` contracts.
- Project/media/camera routes: direct DB logic, uploads, and streaming-related side effects need service boundaries and upload policy enforcement.
- AI routes: expensive execution paths need idempotency, async job boundaries, audit records, and cost metrics.
- Integration webhooks/OAuth routes: webhook validation must happen before persistence, enqueueing, or side effects.
- Analytics/export routes: potentially expensive reads and PDF/export flows should become async jobs with traceable status endpoints.
- Auth/register/login-check routes: response envelopes can stay legacy-compatible, but security telemetry and lifecycle audit need to be centralized.

## First Implemented Slice

Durable tenant-scoped idempotency has been added for canonical v1 writes:

- `POST /api/v1/clients`
- `POST /api/v1/tasks`
- `POST /api/v1/invoices`
- `PATCH /api/v1/invoices/{id}`
- `DELETE /api/v1/invoices/{id}`

The new `IdempotencyKey` table stores request body hashes, processing status, response snapshots, expiration, route/method metadata, and company isolation.
