import dotenv from 'dotenv'
dotenv.config()

import { prisma } from '../src/lib/db'
import { createHash } from 'crypto'

type CompanyDiagnosticRow = {
  id: string
  name: string
  status: string
}

type LoginAttemptDiagnosticRow = {
  id: string
  success: boolean
  reason: string | null
  createdAt: Date
}

function usage() {
  console.log('Usage: tsx scripts/check-login-diagnostics.ts --email user@example.com')
}

async function main() {
  const argv = process.argv.slice(2)
  const emailArgIndex = argv.findIndex((a) => a === '--email' || a === '-e')
  if (emailArgIndex === -1 || !argv[emailArgIndex + 1]) {
    usage()
    process.exit(1)
  }

  const email = String(argv[emailArgIndex + 1]).trim().toLowerCase()
  console.log(`Checking account for: ${email}`)

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.log('User not found in database.')
    process.exit(0)
  }

  console.log('User:')
  console.log({ id: user.id, email: user.email, role: user.role, accountStatus: user.accountStatus, companyId: user.companyId, authUserId: user.authUserId, createdAt: user.createdAt })

  if (user.companyId) {
    try {
      const company = await prisma.$queryRawUnsafe<CompanyDiagnosticRow[]>(
        `SELECT "id", "name", "status" FROM "Company" WHERE "id" = $1 LIMIT 1`,
        user.companyId
      )
      console.log('Company:')
      console.log(company?.[0] ?? company)
    } catch {
      console.log('Could not read company record using raw query.')
    }
  }

  // Query recent login attempts
  const emailHash = createHash('sha256').update(email).digest('hex')
  try {
    const attempts = await prisma.$queryRawUnsafe<LoginAttemptDiagnosticRow[]>(
      `SELECT "id", "success", "reason", "createdAt" FROM "auth_login_attempts" WHERE "emailHash" = $1 ORDER BY "createdAt" DESC LIMIT 10`,
      emailHash
    )
    console.log('Recent login attempts (most recent first):')
    console.table(attempts)
  } catch {
    console.log('Could not query auth_login_attempts table (it may not exist).')
  }

  await prisma.$disconnect()
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
