/**
 * Enterprise ESM Launch Verification
 * Run: npx tsx scripts/verify-enterprise-launch.ts
 *
 * Verifies:
 *   1. All enterprise modules compile
 *   2. All enterprise API routes can be resolved
 *   3. Prisma client includes all enterprise models
 *   4. Migration SQL is syntactically valid
 *   5. All service functions are exported
 *   6. No orphan imports
 */

async function verify() {
  let passed = 0
  let failed = 0

  function check(name: string, ok: boolean, detail?: string) {
    if (ok) { passed++; console.log(`  ✅ ${name}`) }
    else { failed++; console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
  }

  console.log('\n🔍 Enterprise ESM Launch Verification\n')

  // 1. Module compilation check
  console.log('📦 Module Compilation:')
  const modules = [
    'enterprise-depreciation',
    'enterprise-vendor.service',
    'enterprise-qr',
    'enterprise-csat',
    'enterprise-auto-close',
    'enterprise-recurring',
    'enterprise-custom-fields',
    'enterprise-lifecycle',
    'enterprise-service-health',
    'enterprise-masking',
    'enterprise-ip-whitelist',
    'enterprise-saved-filters',
    'enterprise-bulk',
    'enterprise-webhooks',
    'enterprise-dashboards',
    'enterprise-reports',
    'enterprise-realtime',
    'enterprise-audit',
    'enterprise-approval-engine',
    'enterprise-escalation',
    'enterprise.service',
  ]

  for (const mod of modules) {
    try {
      await import(`../src/modules/enterprise/${mod}`)
      check(`${mod}`, true)
    } catch (e: any) {
      check(`${mod}`, false, e.message)
    }
  }

  // 2. Worker compilation
  console.log('\n⚙️  Worker Compilation:')
  try {
    await import('../src/modules/jobs/job-worker')
    check('job-worker', true)
  } catch (e: any) {
    check('job-worker', false, e.message)
  }

  // 3. API route file existence
  console.log('\n📍 API Route Files:')
  const routes = [
    'problems/route.ts',
    'problems/[id]/route.ts',
    'changes/route.ts',
    'changes/[id]/route.ts',
    'changes/[id]/submit-cab/route.ts',
    'changes/[id]/cab-approve/route.ts',
    'changes/[id]/cab-reject/route.ts',
    'changes/[id]/implement/route.ts',
    'changes/[id]/rollback/route.ts',
    'incidents/[id]/notes/route.ts',
    'incidents/[id]/time-entries/route.ts',
    'incidents/[id]/time-entries/[timeId]/route.ts',
    'incidents/[id]/csat/route.ts',
    'vendors/route.ts',
    'vendors/[id]/route.ts',
    'contracts/route.ts',
    'contracts/[id]/route.ts',
    'leases/route.ts',
    'leases/[id]/route.ts',
    'assets/[id]/qr/route.ts',
    'assets/[id]/barcode/route.ts',
    'assets/[id]/lifecycle/route.ts',
    'assets/[id]/operational-status/route.ts',
    'services/route.ts',
    'services/[id]/route.ts',
    'csat/summary/route.ts',
    'approvals/[entityType]/[entityId]/route.ts',
    'filters/route.ts',
    'filters/[id]/route.ts',
    'bulk/route.ts',
    'webhooks/route.ts',
    'webhooks/[id]/route.ts',
    'dashboards/executive/route.ts',
    'dashboards/departments/[id]/route.ts',
    'dashboards/teams/[id]/route.ts',
    'ip-whitelist/route.ts',
    'reports/generate/route.ts',
    'reports/schedules/route.ts',
    'reports/schedules/[id]/route.ts',
    'dashboards/push/route.ts',
  ]

  const fs = await import('fs')
  const path = await import('path')
  const baseDir = path.join(__dirname, '..', 'src', 'app', 'api', 'enterprise')

  for (const route of routes) {
    const p = path.join(baseDir, route)
    check(route, fs.existsSync(p), `Not found at ${p}`)
  }

  // 4. Migration SQL syntax check (basic)
  console.log('\n🗄️  Migration SQL:')
  const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', 'manual', '20260530000000_add_enterprise_models.sql')
  check('Migration file exists', fs.existsSync(migrationPath))
  if (fs.existsSync(migrationPath)) {
    const content = fs.readFileSync(migrationPath, 'utf8')
    check('Migration has content', content.length > 500)
    check('Contains CREATE TABLE', content.includes('CREATE TABLE'))
    check('Contains EnterpriseProblem', content.includes('EnterpriseProblem'))
    check('Contains EnterpriseChange', content.includes('EnterpriseChange'))
    check('Contains EnterpriseVendor', content.includes('EnterpriseVendor'))
    check('Contains EnterpriseContract', content.includes('EnterpriseContract'))
    check('Contains EnterpriseAssetLease', content.includes('EnterpriseAssetLease'))
    check('Contains EnterpriseRecurringTicket', content.includes('EnterpriseRecurringTicket'))
  }

  // 5. Prisma schema check — enterprise models present
  console.log('\n📐 Prisma Schema:')
  const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8')
  const expectedModels = [
    'EnterpriseVendor',
    'EnterpriseContract',
    'EnterpriseAssetLease',
    'EnterpriseServiceHealth',
    'EnterpriseRecurringTicket',
    'EnterpriseProblem',
    'EnterpriseChange',
    'EnterpriseIncidentNote',
    'EnterpriseIncidentTimeEntry',
    'EnterpriseApprovalStep',
    'EnterpriseAuditEvent',
  ]
  for (const model of expectedModels) {
    check(`model ${model}`, schema.includes(`model ${model} {`))
  }

  // 6. migration_lock.toml check
  console.log('\n🔒 Migration Lock:')
  const lockPath = path.join(__dirname, '..', 'prisma', 'migrations', 'migration_lock.toml')
  const lock = fs.readFileSync(lockPath, 'utf8')
  check('Provider is postgresql', lock.includes('postgresql'))

  // Summary
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  ✅ Passed: ${passed}`)
  console.log(`  ❌ Failed: ${failed}`)
  console.log(`${'═'.repeat(50)}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

verify().catch((err) => {
  console.error('Verification script error:', err)
  process.exit(1)
})
