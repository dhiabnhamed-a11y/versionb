#!/usr/bin/env node
/**
 * CI CHECK: Tenant Scoping Enforcement
 * 
 * This script fails the build if:
 * 1. Any API route exports a bare `export async function GET/POST/...` that is NOT wrapped in withApiHandler/apiRoute/handleApiRoute.
 * 2. Any file outside the approved allowlist uses prisma.$queryRaw or prisma.$executeRaw directly.
 *
 * Run: npx tsx scripts/check-tenant-scoping.ts
 */

import { readFileSync } from 'fs'
import { globSync } from 'glob'

let failures = 0

// ─── CHECK 1: Unwrapped API Routes ──────────────────────────────────────────

const RAW_EXPORT_RE = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g
const WRAPPER_RE = /withApiHandler|apiRoute|handleApiRoute/

const ROUTE_ALLOWLIST = new Set([
  // Truly public / webhook routes that must NOT be wrapped in tenant context:
  'src/app/api/billing/webhook/stripe/route.ts',
  'src/app/api/webhooks/dodo/route.ts',
  'src/app/api/health/route.ts',
  'src/app/api/ready/route.ts',
  'src/app/api/client-portal/[token]/route.ts',
  'src/app/api/integrations/webhooks/[provider]/route.ts',
])

const routeFiles = globSync('src/app/api/**/route.ts')

for (const file of routeFiles) {
  const normalizedPath = file.split('\\').join('/')
  if (ROUTE_ALLOWLIST.has(normalizedPath)) continue

  const content = readFileSync(file, 'utf8')

  if (RAW_EXPORT_RE.test(content) && !WRAPPER_RE.test(content)) {
    console.error(`FAIL: Unwrapped route handler in ${file}`)
    failures++
  }
  // Reset regex lastIndex
  RAW_EXPORT_RE.lastIndex = 0
}

// ─── CHECK 2: Raw SQL Outside Approved Helpers ──────────────────────────────

const RAW_SQL_ALLOWLIST = new Set([
  'src/lib/tenant/tenant-raw-query.ts',
  'src/lib/tenant/prisma-context.ts',
  'src/lib/db.ts',
  'src/lib/infra/health.ts',
  'src/lib/delete-graph.ts', // Uses tx.$executeRaw inside transactions
])

const RAW_SQL_RE = /prisma\.\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)/

const allTsFiles = globSync('src/**/*.{ts,tsx}')

for (const file of allTsFiles) {
  const normalizedPath = file.split('\\').join('/')
  if (RAW_SQL_ALLOWLIST.has(normalizedPath)) continue

  const content = readFileSync(file, 'utf8')
  if (RAW_SQL_RE.test(content)) {
    console.error(`FAIL: Direct prisma.$queryRaw/$executeRaw in ${file} — use tenantQueryRaw/tenantExecuteRaw instead`)
    failures++
  }
}

// ─── RESULT ─────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\n❌ ${failures} tenant scoping violation(s) found. Fix them before merging.`)
  process.exit(1)
} else {
  console.log('✅ All API routes are wrapped and all raw SQL uses approved helpers.')
  process.exit(0)
}
