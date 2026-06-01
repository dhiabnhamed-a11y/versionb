/**
 * Demo seed CLI — thin wrapper around src/lib/demo-seed.ts
 *
 * Usage:
 *   npx tsx prisma/seed-demo.ts
 *   npm run seed:demo
 *
 * Reset:
 *   DEMO_RESET=true npx tsx prisma/seed-demo.ts
 *   npm run seed:demo:reset
 */

import { runDemoSeed, DEMO_PASSWORD } from '@/lib/demo-seed'

async function main() {
  const reset = process.env.DEMO_RESET === 'true'
  console.log(`Seeding demo workspaces${reset ? ' (reset=true)' : ''}...\n`)

  const result = await runDemoSeed(reset)

  console.log('\n================================================================')
  console.log('Demo seed complete')
  console.log('================================================================\n')
  console.log('Password (all accounts): ' + DEMO_PASSWORD + '\n')

  for (const ws of result.workspaces) {
    console.log(`--- ${ws.name} (${ws.type}) ---`)
    for (const acc of result.accounts.filter((a) => a.workspace === ws.name)) {
      console.log(`  ${acc.email.padEnd(45)} ${acc.role}`)
    }
    console.log()
  }

  console.log('Reset:   DEMO_RESET=true npx tsx prisma/seed-demo.ts')
}

main().catch((err) => { console.error('Seed failed:', err); process.exit(1) })
