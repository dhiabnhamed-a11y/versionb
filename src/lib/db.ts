import { PrismaClient } from '@prisma/client'

// Prisma Client always uses DATABASE_URL. If it points at db.*.supabase.co:5432, sign-up/API
// calls often fail from Vercel or IPv4-only networks; use the Transaction pooler (6543) there.
const dbUrl = process.env.DATABASE_URL ?? ''
if (
  dbUrl &&
  /db\.[a-z0-9-]+\.supabase\.co:5432/i.test(dbUrl) &&
  !dbUrl.includes('pooler.supabase.com')
) {
  console.warn(
    '[db] DATABASE_URL uses the direct Supabase host (db.*:5432). Set DATABASE_URL to the Transaction pooler (port 6543, *.pooler.supabase.com) for the app; use DIRECT_URL for migrations. See .env.example.'
  )
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
