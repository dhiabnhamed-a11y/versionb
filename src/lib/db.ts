import { PrismaClient } from '@prisma/client'
import { createTenantAuditExtension } from '@/lib/prisma-tenant'

// Prisma Client always uses DATABASE_URL. If it points at db.*.supabase.co:5432, sign-up/API
// calls often fail from Vercel or IPv4-only networks; use the Transaction pooler (6543) there.
const dbUrl = process.env.DATABASE_URL ?? ''
const isUsingDirectSupabaseHost =
  dbUrl &&
  /db\.[a-z0-9-]+\.supabase\.co:5432/i.test(dbUrl) &&
  !dbUrl.includes('pooler.supabase.com')

if (isUsingDirectSupabaseHost) {
  console.warn(
    '[db] DATABASE_URL uses the direct Supabase host (db.*:5432). Set DATABASE_URL to the Transaction pooler (port 6543, *.pooler.supabase.com) for the app; use DIRECT_URL for migrations. See .env.example.'
  )
}

export function getDatabaseConfigHint() {
  if (isUsingDirectSupabaseHost) {
    return 'DATABASE_URL is using the direct Supabase host on port 5432. On Vercel, switch DATABASE_URL to the Supabase Transaction pooler URI on port 6543, keep DIRECT_URL for migrations, and redeploy.'
  }

  return 'Check the Vercel DATABASE_URL, DIRECT_URL, AUTH_SECRET, and production database migrations. If you use Supabase, DATABASE_URL should be the Transaction pooler URI on port 6543.'
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  }).$extends(createTenantAuditExtension())
}

export const prisma = (globalForPrisma.prisma ?? createPrismaClient()) as unknown as PrismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma as ReturnType<typeof createPrismaClient>

export async function disconnectDatabase() {
  await prisma.$disconnect()
}

export async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`
}
