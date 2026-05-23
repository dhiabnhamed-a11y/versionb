# TASKIT Buyer Overview

TASKIT is a multi-tenant B2B operations platform for agencies, service businesses, enterprise operations teams, and healthcare/clinic-style workspaces. It combines project delivery, CRM, client portals, finance, reporting, realtime collaboration, AI assistance, social integrations, and operational workflows in one Next.js application.

This overview is written for buyers before code review. It is based on the evaluation report in `docs/ENTERPRISE_TRANSFORMATION_REPORT.md`, the acquisition deck, and the current repository structure.

## What TASKIT Does

TASKIT is designed to replace a fragmented stack of project management, CRM, billing, client approval, reporting, and operations tools.

The core product thesis is simple: every client promise should connect to the work being done, the people responsible, the approval trail, the invoice, the financial result, and the operational intelligence around it.

TASKIT currently supports several operating modes:

- Agency and creative operations: clients, projects, briefs, deliverables, approvals, media, comments, invoices, and client portals.
- General business operations: projects, tasks, employees, alerts, departments, calendar, reports, and settings.
- Enterprise operations / ITSM-style workflows: assets, incidents, maintenance, SLAs, command center views, and operational dashboards.
- Healthcare operations: patients, departments, shifts, emergency center, incidents, biomedical assets, and healthcare-specific dashboards.
- Finance operations: accounting, approvals, expenses, payroll, treasury, forecasting, reporting, profitability, and CFO-style summaries.
- Social and content operations: OAuth integrations, social analytics, provider sync, and content/channel reporting.
- AI-assisted operations: workspace-aware chat, operational recommendations, workflow context, AI runs, governance, approvals, and safety/audit infrastructure.

## Who It Is For

TASKIT is strongest as a starting point for buyers who want a broad SaaS platform rather than a small single-purpose app.

Best-fit buyers:

- SaaS founders who want a prebuilt B2B operations platform to commercialize.
- Digital agencies or agency groups that want a branded internal operating system.
- MENA-focused SaaS operators who value multilingual and Arabic/RTL positioning.
- Service businesses that need CRM, delivery, finance, and client portal workflows in one place.
- Strategic buyers looking for reusable IP across work management, finance, AI, and operations.
- Technical teams that can finish production hardening, billing, and QA.

Less ideal buyers:

- Non-technical operators expecting a no-maintenance turnkey SaaS.
- Buyers who only want a narrow task board or CRM.
- Buyers who require SOC2-ready enterprise compliance on day one.
- Buyers who need proven recurring revenue already attached to the asset.

## Current Readiness

The evaluation report scores TASKIT at **6.8/10 enterprise readiness** and **6.4/10 acquisition readiness** after the latest transformation pass.

Key strengths from the report:

- Broad domain model across agencies, finance, enterprise operations, healthcare, integrations, and AI.
- Security foundations are present: middleware, CSP/HSTS, session revocation, MFA routes, CSRF checks, health/readiness routes, and production OpenAPI controls.
- Realtime foundation exists through Socket.IO, Redis adapters, event logs, recovery, presence, and load-test tooling.
- Legal/compliance pages and policy documents are implemented.
- The codebase has meaningful architecture separation through `src/modules/*`, `src/lib/api/*`, services, repositories, DTOs, and validation schemas.

Main blockers from the report:

- Many legacy API routes still need migration to the standardized API handler and permission system.
- Tenant isolation needs deeper enforcement, including Postgres RLS policies.
- MFA backend exists, but production-grade enforcement and UI completion remain.
- Billing exists as code, but production revenue instrumentation and live payment validation still need completion.
- Test coverage is thin for the size and risk of the platform.
- Deployment topology needs a final decision because Cloudflare/OpenNext and Node/Socket.IO workloads have different runtime needs.

## Tech Stack

- Frontend and backend: Next.js 16 App Router, React 19, TypeScript.
- Server runtime: custom `tsx` Node server for the main app and realtime support.
- Database: Prisma ORM with SQL migrations; local/dev SQLite artifacts are present, with architecture aimed at PostgreSQL-style production deployment and tenant controls.
- Auth: NextAuth v5 beta, bcrypt-based auth paths, role/session utilities, session revocation, MFA route support.
- Realtime: Socket.IO, Socket.IO Redis adapter/emitter, presence, recovery, realtime event log.
- Queue/workers: BullMQ, Redis, dedicated worker entrypoints for realtime, notifications, AI, and media.
- Payments: Stripe and Dodo Payments adapters, checkout route, portal support, and webhook handling.
- Files/media: Cloudinary support, media comments, project media studio, camera/RTSP helpers, video.js, m3u8 parsing.
- AI: OpenAI integration wrapper, operational AI modules, retrieval/context services, governance, tool execution, approvals, safety evaluation, and metrics.
- PDFs/documents: `@react-pdf/renderer` for invoices, contracts, and stats/report exports.
- Validation and API shape: Zod schemas, shared API helpers, DTOs, pagination, rate limiting, request guards, idempotency.
- Deployment/config: Vercel-style app support, OpenNext Cloudflare config, Wrangler config, environment verification scripts.

## Local Setup

These steps are intended for a technical buyer starting from a fresh checkout.

Prerequisites:

- Node.js `22.17.0` or newer.
- npm.
- PostgreSQL database. Supabase works; a local Postgres database also works.
- Optional but recommended for full realtime/workers: Redis on `redis://localhost:6379`.
- Optional for media, payments, push, and social integrations: Cloudinary, Stripe or Dodo Payments, Firebase, and OAuth provider apps.

If Redis is not installed locally, blank these values in `.env` for a basic app review: `REDIS_URL`, `QUEUE_REDIS_URL`, `INTEGRATIONS_REDIS_URL`, and `REALTIME_REDIS_URL`. Leave `NEXT_PUBLIC_SOCKET_IO_ENABLED="false"` until Redis/realtime is being tested.

1. Install dependencies:

```bash
npm install
```

2. Create a local env file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Fill the required local variables in `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
NEXTAUTH_SECRET="generate-a-long-random-string"
AUTH_SECRET="generate-a-long-random-string"
NEXTAUTH_URL="http://localhost:3000"
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"
SUPER_ADMIN_EMAILS="you@example.com"
LEGAL_CONSENT_SIGNING_SECRET="generate-a-long-random-string"
CAMERA_ENCRYPTION_KEY="generate-a-long-random-string"
SOCIAL_TOKEN_ENCRYPTION_KEY="base64-encoded-32-byte-key"
SOCIAL_TOKEN_ENCRYPTION_KEY_ID="primary"
```

Generate strong local secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

For Supabase production-style database URLs, use:

- `DATABASE_URL`: transaction pooler URI, usually port `6543`, with `pgbouncer=true`.
- `DIRECT_URL`: direct/session connection URI, usually port `5432`, used by Prisma migrations.

4. Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

5. Seed demo data:

```bash
npm run db:seed
```

Seeded demo accounts use password `password123`:

- Owner: `owner@taskforce.com`
- Manager: `manager@taskforce.com`
- Employee: `emp1@taskforce.com`
- Employee: `emp2@taskforce.com`
- Super admin: first email in `SUPER_ADMIN_EMAILS`, if configured

6. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

The app uses `server.ts` for local development, so the custom Next.js server and Socket.IO attachment path are available from the same process. Realtime browser features are gated by `NEXT_PUBLIC_SOCKET_IO_ENABLED`; leave it `false` if Redis/Socket.IO is not part of the local review.

7. Run verification checks:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

For a full pre-push confidence check:

```bash
npm run prepush
```

## Environment Variables

Use `.env.example` as the canonical template. The table below explains what a buyer must configure to run the app and what can be deferred until a feature is tested.

### Required For Core Local App

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Main Prisma connection used by the app. |
| `DIRECT_URL` | Direct Prisma migration connection. |
| `NEXTAUTH_SECRET` | NextAuth/Auth.js signing secret. |
| `AUTH_SECRET` | App auth secret; can match `NEXTAUTH_SECRET`. |
| `NEXTAUTH_URL` | Canonical auth URL, `http://localhost:3000` locally. |
| `AUTH_URL` | Auth.js URL, `http://localhost:3000` locally. |
| `NEXT_PUBLIC_APP_URL` | Browser-visible app origin. |
| `APP_URL` | Server-side app origin. |
| `AUTH_TRUST_HOST` | Set `true` locally and in trusted proxy deployments. |
| `SUPER_ADMIN_EMAILS` | Comma-separated platform admin emails. |
| `LEGAL_CONSENT_SIGNING_SECRET` | Signs legal consent/audit records. |
| `CAMERA_ENCRYPTION_KEY` | Encrypts stored camera credentials. |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | Base64 32-byte key for OAuth/social token encryption. |
| `SOCIAL_TOKEN_ENCRYPTION_KEY_ID` | Key identifier, usually `primary`. |

### Payments

Set `PAYMENT_PROVIDER` to `stripe` or `dodo`.

Stripe:

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server-side Stripe API key. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser Stripe publishable key. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret. |
| `STRIPE_PRICE_MONTHLY` | Starter monthly price ID. |
| `STRIPE_PRICE_YEARLY` | Starter yearly price ID. |
| `STRIPE_PRICE_LIFETIME` | Lifetime price ID. |
| `STRIPE_PRICE_TEAM_MONTHLY` | Team monthly price ID. |

Dodo Payments:

| Variable | Purpose |
| --- | --- |
| `DODO_PAYMENTS_API_KEY` | Dodo Payments API key. |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Dodo webhook verification key. |
| `DODO_ENV` | Use `live` for live mode; any other value runs test mode in code. |
| `DODO_STARTER_PRODUCT_ID` | Starter product ID. |
| `DODO_TEAM_PRODUCT_ID` | Team product ID. |
| `DODO_LIFETIME_PRODUCT_ID` | Lifetime product ID. |

### Supabase And Storage

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase service role key. |
| `SUPABASE_PROJECT_CAMERA_BUCKET` | Storage bucket for project camera uploads. |

### Cloudinary Media

| Variable | Purpose |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret. |

### Realtime, Redis, And Workers

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SOCKET_IO_ENABLED` | Enables browser Socket.IO features when set to `true`. |
| `NEXT_PUBLIC_SOCKET_IO_URL` | Optional separate realtime origin. |
| `NEXT_PUBLIC_SOCKET_IO_PATH` | Browser Socket.IO path, default `/api/socketio`. |
| `SOCKET_IO_PATH` | Server Socket.IO path. |
| `REALTIME_REDIS_URL` | Redis URL for realtime. |
| `REDIS_URL` | General Redis URL. |
| `QUEUE_REDIS_URL` | BullMQ queue Redis URL. |
| `INTEGRATIONS_REDIS_URL` | Integrations cache/queue Redis URL. |
| `REALTIME_HEALTH_TOKEN` | Protects `/api/realtime/health` in production. |
| `REALTIME_GATEWAY_HOST` | Host for separate realtime gateway. |
| `REALTIME_GATEWAY_PORT` | Port for separate realtime gateway. |
| `REALTIME_WORKER_CONCURRENCY` | Realtime worker concurrency. |

Useful worker commands:

```bash
npm run worker
npm run worker:realtime
npm run worker:notifications
npm run worker:ai
npm run worker:media
npm run gateway:realtime
```

### Firebase Push Notifications

Browser Firebase:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID. |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web push VAPID key. |

Server Firebase Admin:

| Variable | Purpose |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Firebase project ID. |
| `FIREBASE_CLIENT_EMAIL` | Admin SDK client email. |
| `FIREBASE_PRIVATE_KEY` | Admin SDK private key with escaped newlines. |

### Social OAuth Integrations

Shared integration settings:

| Variable | Purpose |
| --- | --- |
| `SOCIAL_WEBHOOK_SECRET` | HMAC/shared webhook secret for social providers. |
| `SOCIAL_WEBHOOK_VERIFY_TOKEN` | Verification token for provider callbacks. |
| `TASKIT_API_SIGNATURE_SECRET` | First-party API request signing secret for `X-Taskit-Signature`. |
| `OAUTH_DEBUG` | Enables OAuth debug logging when `true`. |
| `SOCIAL_OAUTH_BASE_URL` | Optional fixed social callback origin. |
| `OAUTH_BASE_URL` | Optional fixed OAuth callback origin. |
| `OAUTH_ALLOWED_ORIGINS` | Comma-separated origins allowed to generate redirect URIs. |

Provider credentials:

| Variable | Provider |
| --- | --- |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | YouTube/Google |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Spotify |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | TikTok |
| `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` | Instagram/Meta |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | Facebook/Meta |
| `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` | X/Twitter |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Twitch |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn |

### Miscellaneous Controls

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | Browser analytics flag; default `false`. |
| `ALLOW_LOGIN_CHECK` | Enables/disables login-check endpoint; keep `false` in production. |
| `FFMPEG_PATH` | Path to `ffmpeg` for camera/media processing. |
| `INVITE_TTL_HOURS` | Invite expiration window. |
| `BLOCKED_OWNER_EMAIL_DOMAINS` | Blocks consumer email domains for owner signup. |
| `OWNER_ALLOWED_EMAIL_DOMAINS` | Optional allowlist for owner signup domains. |
| `BREACHED_PASSWORD_SHA1_HASHES` | Optional blocked password hash list. |
| `DEPLOY_PLATFORM` | Deployment label, e.g. `cloudflare-opennext`. |

## Production Deployment Notes

Before production deployment:

```bash
npm run verify:env
npm run prepush
```

Recommended production decisions:

- Use a managed PostgreSQL database. For Supabase on Vercel, use the transaction pooler in `DATABASE_URL` and the direct/session URL in `DIRECT_URL`.
- Use Redis if realtime, workers, queues, integrations, or command-center caching are enabled.
- Pick one primary payment provider first and validate checkout, webhook, subscription state, plan limits, and cancellation paths end to end.
- Decide deployment topology before launch. The repo includes Cloudflare/OpenNext config, but Socket.IO and BullMQ are Node-oriented workloads and may be cleaner as a Node service plus workers.
- Set `REALTIME_HEALTH_TOKEN`, `LEGAL_CONSENT_SIGNING_SECRET`, `SUPER_ADMIN_EMAILS`, auth secrets, payment webhook secrets, and OAuth secrets in the production secret manager.
- Register exact OAuth callback URLs for each provider. Wildcard preview URLs are generally not accepted by major OAuth providers.

## What Is Built

Product surfaces:

- Landing, login, signup, invite, billing, legal, privacy, cookies, DPA, acceptable use, and AI transparency pages.
- Role-based dashboard shell with admin, employee, settings, and super-admin areas.
- Clients, projects, tasks, invoices, calendar, employees, reports, finance, assets, operations, alerts, maintenance, healthcare, shifts, emergency center, and social analytics pages.
- Client portal routes with token-based access.
- Rich text editor/content components, dashboard command palette, notifications, realtime connection status, onboarding, workspace tour, and design settings.

Backend/API:

- REST-style API routes for tasks, projects, clients, invoices, alerts, finance, enterprise operations, integrations, legal admin, billing, auth, AI, cameras, calendar events, comments, deliverables, and health.
- Versioned `api/v1` routes for tasks, projects, invoices, clients, alerts, and OpenAPI.
- Shared service/repository layers for major domains including accounting, clients, projects, tasks, reporting, integrations, enterprise, finance, AI, realtime, security, and alerts.
- Prisma migrations covering onboarding, roles, push tokens, cameras, company workflows, approvals, invoices, media, calendar, client portal, dashboard design, enterprise foundations, social integrations, AI governance, finance, contracts, idempotency, legal consent, security, healthcare, and realtime event logs.

Security and governance:

- Middleware protection for dashboard/API access patterns.
- CSRF origin/referer checks for production mutations.
- Session revocation via JWT `jti`, `AuthSession`, `RevokedToken`, and revoke route.
- MFA enrollment, verification, recovery code, and status routes.
- Request signing/HMAC utilities and integration token crypto.
- Audit logging modules and legal consent architecture.
- Production guards, request timeout helpers, rate limiting, idempotency, and API error handling.

Commercial assets:

- Acquisition deck: `taskit-acquisition-deck.html`.
- Sales demo deck: `taskit-demo.html`.
- Strategy and architecture docs under `docs/`.
- Legal document set under `docs/legal/` and implemented legal pages.
- Environment template, deployment configs, scripts, and seed/migration assets.

## What Is Not Finished

These are the most important diligence items before launch or resale:

- Billing is not yet proven as a live revenue system. Stripe and Dodo code exists, but buyers should validate provider configuration, webhook behavior, plan mapping, subscriptions, metering, plan limits, and production MRR reporting.
- API governance is uneven. Priority domains use cleaner service/repository patterns, but many legacy `/api/*` routes still need migration to the standardized route wrapper and permission checks.
- Tenant isolation needs hardening. Prisma tenant helpers exist, but Postgres RLS policies and route-by-route enforcement should be completed before enterprise deployment.
- MFA is partially implemented. Backend routes exist; UI completion and mandatory enforcement for owner/manager roles are still roadmap items.
- Test coverage is too thin for the product surface. Current unit/security tests exist, but auth, tenant isolation, billing, portal access, integrations, and critical user flows need integration and E2E coverage.
- Deployment architecture needs finalization. Realtime Socket.IO/BullMQ workloads are Node-oriented; Cloudflare/OpenNext deployment is also configured. A buyer should choose a clean production topology.
- Observability is not complete. Health/readiness routes exist, but OpenTelemetry, Sentry/Grafana-style monitoring, alerting, DLQ monitoring, and runbooks remain roadmap work.
- AI provider config needs review. The code still references a default `gpt-5.5` model ID in `src/lib/ai-openai.ts`; this should be updated to a currently supported model before demos.
- Design system is still emerging. There are reusable UI components and design tokens, but the evaluation report calls for Storybook/design-system cleanup and CSS modularization.
- Compliance is not certification-ready. Legal pages and audit concepts exist, but SOC2-style exports, formal controls, and enterprise SSO/SAML are future roadmap items.

## Evaluation Report Snapshot

From `docs/ENTERPRISE_TRANSFORMATION_REPORT.md`:

| Area | Score | Target |
| --- | ---: | ---: |
| Architecture | 7.2 | 9+ |
| Security | 7.8 | 9.5+ |
| Scalability | 6.9 | 9+ |
| Infrastructure | 6.5 | 9+ |
| Code quality | 7.0 | 9+ |
| UI/UX | 7.4 | 9+ |
| DevOps/QA | 6.2 | 9+ |
| Business/SaaS | 5.8 | 9+ |
| Acquisition readiness | 6.4 | 9+ |
| Enterprise readiness | 6.8 | 9+ |

## Recommended Buyer Path

First 30 days:

1. Validate billing end to end with one provider and one paid plan.
2. Fix AI model configuration and verify the AI demo path.
3. Finish MFA UI and owner/manager enforcement.
4. Migrate the highest-risk legacy API routes to the shared handler and permission system.
5. Add E2E smoke tests for signup, login, dashboard, client/project/task flows, billing checkout, and client portal access.
6. Decide production deployment topology: Node app plus Redis/BullMQ/Socket.IO, or a split Cloudflare/static plus Node realtime/workers approach.
7. Publish a live demo with seeded data and a clean buyer walkthrough.

Next 90 days:

- Complete RLS policies and tenant isolation tests.
- Add observability, DLQ monitoring, and operational runbooks.
- Finish API governance migration.
- Add materialized views or cached aggregates for dashboard analytics.
- Build a design-system pass for the dashboard and admin surfaces.
- Add compliance/audit exports for enterprise diligence.

## Bottom Line

TASKIT is not just a task app. It is a broad, partially hardened operations SaaS with real product surface area across agency workflows, finance, enterprise operations, healthcare, integrations, realtime collaboration, and AI.

The asset is most valuable to a buyer who wants a large technical head start and is comfortable finishing the last mile: billing validation, API/security hardening, tenant isolation, tests, observability, and deployment polish.
