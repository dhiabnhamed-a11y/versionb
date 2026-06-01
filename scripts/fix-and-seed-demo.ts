/**
 * Creates the missing CalendarEvent table, then seeds all demo accounts.
 * Run: npx tsx scripts/fix-and-seed-demo.ts
 */
import { prisma } from '@/lib/db'
import { runDemoSeed, DEMO_PASSWORD } from '@/lib/demo-seed'

async function ensureCalendarEvent() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CalendarEvent" (
      "id"          TEXT          NOT NULL,
      "title"       TEXT          NOT NULL,
      "description" TEXT,
      "type"        TEXT          NOT NULL DEFAULT 'PROJECT_EVENT',
      "startsAt"    TIMESTAMP(3)  NOT NULL,
      "endsAt"      TIMESTAMP(3),
      "color"       TEXT,
      "companyId"   TEXT          NOT NULL,
      "projectId"   TEXT,
      "taskId"      TEXT,
      "createdById" TEXT          NOT NULL,
      "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
    )
  `)

  const fks: [string, string, string, string][] = [
    ['CalendarEvent_companyId_fkey',   'companyId',   'Company', 'CASCADE'],
    ['CalendarEvent_projectId_fkey',   'projectId',   'Project', 'SET NULL'],
    ['CalendarEvent_taskId_fkey',      'taskId',      'Task',    'SET NULL'],
    ['CalendarEvent_createdById_fkey', 'createdById', 'User',    'CASCADE'],
  ]

  for (const [name, col, ref, onDelete] of fks) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "CalendarEvent" ADD CONSTRAINT "${name}" FOREIGN KEY ("${col}") REFERENCES "${ref}"("id") ON DELETE ${onDelete} ON UPDATE CASCADE`
      )
    } catch { /* already exists */ }
  }

  const indexes: string[] = [
    `CREATE INDEX IF NOT EXISTS "CalendarEvent_companyId_startsAt_idx" ON "CalendarEvent"("companyId","startsAt")`,
    `CREATE INDEX IF NOT EXISTS "CalendarEvent_projectId_startsAt_idx" ON "CalendarEvent"("projectId","startsAt")`,
    `CREATE INDEX IF NOT EXISTS "CalendarEvent_taskId_idx"             ON "CalendarEvent"("taskId")`,
  ]
  for (const idx of indexes) {
    try { await prisma.$executeRawUnsafe(idx) } catch { /* exists */ }
  }

  console.log('CalendarEvent table ready.')
}

async function main() {
  console.log('Applying missing schema...')
  await ensureCalendarEvent()

  console.log('\nSeeding demo workspaces...\n')
  const result = await runDemoSeed(false)

  console.log('\n================================================================')
  console.log('DONE — demo accounts are live on https://taskitbeta-tan.vercel.app')
  console.log('================================================================\n')
  console.log(`Password for ALL accounts: ${DEMO_PASSWORD}\n`)

  for (const ws of result.workspaces) {
    console.log(`--- ${ws.name} ---`)
    for (const acc of result.accounts.filter(a => a.workspace === ws.name)) {
      console.log(`  ${acc.role.padEnd(10)} ${acc.email}`)
    }
    console.log()
  }
}

main()
  .catch(err => { console.error('FAILED:', err.message ?? err); process.exit(1) })
  .finally(() => prisma.$disconnect())
