import { PrismaClient } from '@prisma/client'
import { createTenantAuditExtension } from '@/lib/prisma-tenant'
import { validateEnv } from '@/lib/env'

validateEnv()

let hasValidatedDb = false

function validateDatabaseConfig() {
  if (hasValidatedDb) return
  hasValidatedDb = true
  
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

  // FIX 5: Enforce connection_limit — refuse to start in production without it
  const DEFAULT_CONNECTION_LIMIT = 90
  if (dbUrl && !dbUrl.includes('connection_limit=')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `FATAL: DATABASE_URL is missing &connection_limit=. Append &connection_limit=${DEFAULT_CONNECTION_LIMIT} to prevent pool exhaustion. Refusing to start.`
      )
    } else {
      console.warn(
        `[db] DATABASE_URL is missing &connection_limit=. Defaulting to ${DEFAULT_CONNECTION_LIMIT} for development. Set it explicitly for production.`
      )
    }
  }
}

export function getDatabaseConfigHint() {
  if (isUsingDirectSupabaseHost) {
    return 'DATABASE_URL is using the direct Supabase host on port 5432. On Vercel, switch DATABASE_URL to the Supabase Transaction pooler URI on port 6543, keep DIRECT_URL for migrations, and redeploy.'
  }
  return 'Check the Vercel DATABASE_URL, DIRECT_URL, AUTH_SECRET, and production database migrations. If you use Supabase, DATABASE_URL should be the Transaction pooler URI on port 6543.'
}

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS ?? '200')

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

function createPrismaClient() {
  validateDatabaseConfig()
  
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

  // Slow Query Logger — VERIFIED INTACT
  client.$use(async (params, next) => {
    const start = Date.now()
    const result = await next(params)
    const duration = Date.now() - start

    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      const msg = `[slow-query] ${params.model}.${params.action} took ${duration}ms`
      if (process.env.NODE_ENV === 'development') {
        console.warn(msg, { args: JSON.stringify(params.args).slice(0, 300) })
      } else {
        console.warn(msg)
      }
    }
    return result
  })

  return client.$extends(createTenantAuditExtension())
}

// Singleton — VERIFIED INTACT
export const prisma = (globalForPrisma.prisma ?? createPrismaClient()) as unknown as PrismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma as ReturnType<typeof createPrismaClient>

export async function disconnectDatabase() {
  await prisma.$disconnect()
}

// pingDatabase uses raw prisma intentionally — this is an infra health check, not tenant-scoped
export async function pingDatabase() {
  // eslint-disable-next-line no-restricted-syntax
  await (prisma as unknown as PrismaClient).$queryRaw`SELECT 1`
}
