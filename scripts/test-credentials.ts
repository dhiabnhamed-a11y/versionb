import dotenv from 'dotenv'
dotenv.config()

import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '../src/lib/db'
import { createHash } from 'crypto'

type LoginAttemptDiagnosticRow = {
  id: string
  success: boolean
  reason: string | null
  createdAt: Date
}

function usage() {
  console.log('Usage: tsx scripts/test-credentials.ts --email user@example.com --password "secret"')
}

async function verifyWithSupabase(email: string, password: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return { ok: false, reason: 'missing_supabase_config' }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error || !data.user) return { ok: false, reason: error?.message ?? 'supabase_user_missing' }
  return { ok: true, authUserId: data.user.id ?? null }
}

async function main() {
  const argv = process.argv.slice(2)
  const emailIndex = argv.findIndex((a) => a === '--email' || a === '-e')
  const passIndex = argv.findIndex((a) => a === '--password' || a === '-p')
  if (emailIndex === -1 || !argv[emailIndex + 1] || passIndex === -1 || !argv[passIndex + 1]) {
    usage()
    process.exit(1)
  }

  const email = String(argv[emailIndex + 1]).trim().toLowerCase()
  const password = String(argv[passIndex + 1])

  console.log(`Testing credentials for ${email}`)

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.log('User not found in DB')
    process.exit(0)
  }

  console.log('User record:')
  console.log({ id: user.id, email: user.email, accountStatus: user.accountStatus, authUserId: user.authUserId, passwordHashLength: user.password?.length ?? 0 })

  const match = await bcrypt.compare(password, user.password)
  console.log('bcrypt.compare result:', match)
  if (match) {
    console.log('Local DB password matched. Credentials should work.')
  } else {
    console.log('Local password did NOT match, attempting Supabase fallback...')
    const sup = await verifyWithSupabase(email, password)
    console.log('Supabase fallback result:', sup)
    if (sup.ok) {
      console.log('Supabase authenticated the user; consider repairing the local password hash.')
    }
  }

  // check recent failed attempts
  const emailHash = createHash('sha256').update(email).digest('hex')
  try {
    const attempts = await prisma.$queryRawUnsafe<LoginAttemptDiagnosticRow[]>(
      `SELECT "id","success","reason","createdAt" FROM "auth_login_attempts" WHERE "emailHash" = $1 ORDER BY "createdAt" DESC LIMIT 20`,
      emailHash
    )
    console.log('Recent login attempts:')
    console.table(attempts)
  } catch {
    console.log('Could not read auth_login_attempts table (may not exist).')
  }

  await prisma.$disconnect()
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
