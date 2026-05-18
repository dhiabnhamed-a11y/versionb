/**
 * Quick pre-deploy env check. Run: npx tsx scripts/verify-vercel-env.ts
 */
const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'AUTH_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'SUPER_ADMIN_EMAILS',
  'LEGAL_CONSENT_SIGNING_SECRET',
] as const

const recommended = ['REDIS_URL', 'REALTIME_HEALTH_TOKEN', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const

let failed = false

for (const name of required) {
  if (!process.env[name]?.trim()) {
    console.error(`[missing] ${name}`)
    failed = true
  } else {
    console.log(`[ok] ${name}`)
  }
}

for (const name of recommended) {
  if (!process.env[name]?.trim()) {
    console.warn(`[optional] ${name} is not set`)
  } else {
    console.log(`[ok] ${name}`)
  }
}

const dbUrl = process.env.DATABASE_URL ?? ''
if (/db\.[a-z0-9-]+\.supabase\.co:5432/i.test(dbUrl) && !dbUrl.includes('pooler.supabase.com')) {
  console.warn('[warn] DATABASE_URL uses direct Supabase host :5432 — use the transaction pooler on :6543 for Vercel.')
}

if (failed) {
  console.error('\nSet the missing variables in Vercel → Settings → Environment Variables, then redeploy.')
  process.exit(1)
}

console.log('\nRequired production variables look configured.')
