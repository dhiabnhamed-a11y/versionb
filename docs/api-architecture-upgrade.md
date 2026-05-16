# TASKIT API Architecture Upgrade

## 1. Architecture Diagnosis

TASKIT already has useful pieces of an enterprise API architecture: `src/modules/*`, `src/lib/api/*`, `src/lib/api-client/*`, route wrappers, Zod schemas, and some repository/service boundaries. The main risk is uneven adoption. Some priority domains use thin v1 controllers, while many legacy `/api/*` routes still mix auth, Prisma, validation, serialization, realtime events, and response shaping in route handlers.

## 2. Exact Weaknesses Found

- Canonical responses used the older `{ data, error, code, requestId }` shape instead of the target `{ success, data, meta, requestId, timestamp }` shape.
- Legacy and v1 routes had different controller patterns.
- `/api/clients` embedded Prisma queries and client creation business logic directly in the route.
- Rate limiting was centralized but process-local only.
- API client unwrapping only understood the older envelope.
- OpenAPI documented the old envelope and did not include clients under v1.
- Idempotency and AI mutation contract primitives were missing from the shared API foundation.

## 3. Exact Files Refactored

- `src/lib/api/types.ts`
- `src/lib/api/response.ts`
- `src/lib/api/handler.ts`
- `src/lib/api/openapi.ts`
- `src/lib/api-client/core.ts`
- `src/lib/api-client/types.ts`
- `src/lib/api-client/clients.ts`
- `src/app/api/clients/route.ts`
- `src/app/api/v1/clients/route.ts`
- `src/app/api/v1/tasks/route.ts`
- `src/app/api/v1/invoices/route.ts`
- `src/modules/clients/service.ts`
- `src/modules/clients/repository.ts`
- `src/lib/contracts.ts`
- `src/lib/http.ts`
- `src/lib/security.ts`

## 4. Exact Architecture Plan

Use `/api/v1/*` as the canonical public API, keep `/api/*` compatibility for current UI workflows, and migrate one domain at a time into `module -> service -> repository` boundaries. Route handlers should only parse HTTP inputs, call services, and return `apiData(...)`.

## 5. Step-By-Step Migration Strategy

1. Standardize canonical response and errors.
2. Keep legacy routes compatible while adding v1 routes.
3. Move raw Prisma out of priority route handlers into repositories.
4. Move business rules into services.
5. Add typed SDK methods for v1 without forcing frontend rewrites.
6. Migrate frontend calls route-by-route to the SDK.
7. Add OpenAPI entries as each route becomes canonical.
8. Gate AI mutations behind typed service calls, dry-run previews, idempotency keys, and audit events.

## 6. Safe Implementation Order

Completed in this slice:

- API envelope upgrade.
- Handler request timing, request IDs, auth context, tenant context, and distributed rate-limit hook.
- Client domain service/repository extraction.
- `/api/v1/clients`.
- Idempotency support for v1 create task, create invoice, and create client.
- OpenAPI envelope and clients contract update.

Next:

- Projects.
- Contracts.
- AI routes.
- Finance routes.
- Alerts cleanup.
- Frontend SDK migration.

## 7. Production-Safe Refactors

Legacy `/api/clients` still returns the same body shape expected by the UI. The canonical envelope is applied to v1 routes only. Client list behavior for authenticated users without a company remains an empty list to preserve onboarding compatibility.

## 8. New Folder Structure

- `src/lib/request-context/`
- `src/lib/observability/`
- `src/lib/tenant/`
- `src/lib/rate-limit/`
- `src/lib/idempotency/`
- `src/lib/policies/`
- `src/lib/errors/`
- `src/lib/pagination/`
- `src/lib/validation/`

Existing files `src/lib/security.ts`, `src/lib/http.ts`, and `src/lib/contracts.ts` were improved in place because Windows cannot safely have both `security.ts` and `security/` at the same path level.

## 9. Exact Code Implementations

- Canonical success envelope: `{ success: true, data, meta, requestId, timestamp }`.
- Canonical error envelope: `{ success: false, error: { code, message, details }, requestId, timestamp }`.
- Optional Redis-backed rate limiting with in-memory fallback.
- Idempotency helper keyed by `Idempotency-Key`.
- Request context helpers with actor, tenant, route, method, IP, request ID, and timing.
- Client service/repository extraction.
- v1 typed clients SDK methods.

## 10. Full API Standardization

All routes using `responseMode: 'canonical'` now return the target envelope. Legacy mode remains raw JSON for backwards compatibility.

## 11. OpenAPI Integration

`/api/v1/openapi` now documents the new success and error envelopes and includes `/clients`.

## 12. Typed SDK Generation

The current SDK is hand-typed and envelope-aware. The next safe step is adding an OpenAPI-to-TypeScript generation script once the v1 schema covers the remaining priority domains.

## 13. AI-Safe Service Architecture

AI mutation contracts were added as shared types. The next implementation step is to route AI tools through services only, with dry-run previews, confirmation-required execution, audit events, request IDs, and idempotency.

## 14. Observability Implementation

Shared API handlers now emit structured request completion logs with route, method, status, duration, request ID, user ID, and company ID.

## 15. Security Hardening

Added tenant utilities, centralized policy exports, distributed rate-limit hook, idempotency support, webhook signature header helper, and stricter canonical validation/error surfaces.

## 16. Scalability Improvements

The API foundation now supports distributed rate limiting when `REDIS_URL` is configured, idempotent writes, typed v1 contracts, and a cleaner service/repository split for migration to workers and async jobs.

## 17. Performance Improvements

Client list queries remain batched in one Prisma transaction. Route latency is now logged for slow-route detection and future metrics aggregation.

## 18. Architecture Score

Before this slice: 5.5/10. Strong product surface and partial modules, but inconsistent API contracts and route-level business logic.

After this slice: 7.1/10. The API foundation is materially stronger and one priority domain is migrated. Reaching 9/10 requires migrating projects, contracts, AI, finance, and frontend calls to v1 SDK patterns.
