import dotenv from 'dotenv'
dotenv.config()

import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/db'

function usage() {
  console.log('Usage: tsx scripts/reset-user-password.ts --email user@example.com --password "NewP@ssw0rd"')
}

async function main() {
  const argv = process.argv.slice(2)
  const emailArgIndex = argv.findIndex((a) => a === '--email' || a === '-e')
  const passArgIndex = argv.findIndex((a) => a === '--password' || a === '-p')
  if (emailArgIndex === -1 || !argv[emailArgIndex + 1] || passArgIndex === -1 || !argv[passArgIndex + 1]) {
    usage()
    process.exit(1)
  }

  const email = String(argv[emailArgIndex + 1]).trim().toLowerCase()
  const newPassword = String(argv[passArgIndex + 1])

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error('User not found')
    process.exit(1)
  }

  const hash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: user.id }, data: { password: hash } })
  console.log(`Password for ${email} has been updated.`)

  await prisma.$disconnect()
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
