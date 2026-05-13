import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

import { getDatabaseConfigHint, prisma } from '@/lib/db'
import { logger } from '@/modules/shared/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!domain) return 'invalid-email'
  const visible = local.slice(0, 2)
  return `${visible}${local.length > 2 ? '***' : '*'}@${domain}`
}

function getUrlShape(value?: string) {
  if (!value) {
    return {
      present: false,
      hostType: 'missing',
      supabasePooler: false,
      directSupabaseHost: false,
      sslModeRequire: false,
      pgbouncer: false,
      connectionLimitOne: false,
    }
  }

  return {
    present: true,
    hostType: value.includes('pooler.supabase.com')
      ? 'supabase-pooler'
      : /db\.[a-z0-9-]+\.supabase\.co:5432/i.test(value)
        ? 'supabase-direct'
        : 'other',
    supabasePooler: value.includes('pooler.supabase.com'),
    directSupabaseHost: /db\.[a-z0-9-]+\.supabase\.co:5432/i.test(value),
    sslModeRequire: value.includes('sslmode=require'),
    pgbouncer: value.includes('pgbouncer=true'),
    connectionLimitOne: value.includes('connection_limit=1'),
  }
}

function isAuthorizedDebugRequest(req: NextRequest) {
  const expected = process.env.DEBUG_DB_TOKEN?.trim()
  if (!expected) return false

  const headerToken = req.headers.get('x-debug-token')?.trim()
  const queryToken = req.nextUrl.searchParams.get('token')?.trim()
  return headerToken === expected || queryToken === expected
}

function formatError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      meta: error.meta,
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  return { message: 'Unknown database error' }
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const authorized = isAuthorizedDebugRequest(req)

  try {
    await prisma.$connect()

    const [connectionProbe, userCount, companyCount, users, tableChecks] = await Promise.all([
      prisma.$queryRaw<Array<{ now: Date; database: string; schema: string }>>`
        select now() as now, current_database() as database, current_schema() as schema
      `,
      prisma.user.count(),
      prisma.company.count(),
      prisma.user.findMany({
        take: 25,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          accountStatus: true,
          companyId: true,
          password: true,
          createdAt: true,
          company: {
            select: {
              status: true,
              companyType: true,
            },
          },
        },
      }),
      prisma.$queryRaw<Array<{ user_table: string | null; company_table: string | null }>>`
        select to_regclass('"User"')::text as user_table, to_regclass('"Company"')::text as company_table
      `,
    ])

    const payload = {
      ok: true,
      router: 'app',
      route: '/api/debug-db',
      runtime: 'nodejs',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      environment: {
        nodeEnv: process.env.NODE_ENV ?? 'unknown',
        vercel: Boolean(process.env.VERCEL),
        vercelEnv: process.env.VERCEL_ENV ?? null,
        databaseUrl: getUrlShape(process.env.DATABASE_URL),
        directUrl: getUrlShape(process.env.DIRECT_URL),
        authSecretPresent: Boolean(process.env.AUTH_SECRET),
        nextAuthSecretPresent: Boolean(process.env.NEXTAUTH_SECRET),
        nextAuthUrlPresent: Boolean(process.env.NEXTAUTH_URL),
        authUrlPresent: Boolean(process.env.AUTH_URL),
        jwtSecretPresent: Boolean(process.env.JWT_SECRET),
      },
      prisma: {
        connected: true,
        database: connectionProbe[0]?.database ?? null,
        schema: connectionProbe[0]?.schema ?? null,
        serverTime: connectionProbe[0]?.now ?? null,
      },
      tables: {
        user: tableChecks[0]?.user_table ?? null,
        company: tableChecks[0]?.company_table ?? null,
        nextAuthAdapterTablesRequired: false,
        authMode: 'credentials-with-jwt-session',
      },
      counts: {
        users: userCount,
        companies: companyCount,
      },
      users: users.map((user) => ({
        id: authorized ? user.id : `${user.id.slice(0, 6)}...`,
        email: authorized ? user.email : maskEmail(user.email),
        role: user.role,
        accountStatus: user.accountStatus,
        companyIdPresent: Boolean(user.companyId),
        companyStatus: user.company?.status ?? null,
        companyType: user.company?.companyType ?? null,
        password: {
          present: Boolean(user.password),
          bcryptShape:
            typeof user.password === 'string' &&
            (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')),
          length: user.password?.length ?? 0,
        },
        createdAt: user.createdAt,
      })),
      hint: getDatabaseConfigHint(),
      privacy: authorized
        ? 'Full user ids and emails are visible because DEBUG_DB_TOKEN matched.'
        : 'User ids and emails are masked. Set DEBUG_DB_TOKEN and pass ?token=... or x-debug-token to reveal exact values temporarily.',
    }

    logger.info('debug_db.success', {
      latencyMs: payload.latencyMs,
      userCount,
      companyCount,
      authorized,
    })

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    logger.error('debug_db.failed', error)

    return NextResponse.json(
      {
        ok: false,
        router: 'app',
        route: '/api/debug-db',
        runtime: 'nodejs',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        environment: {
          nodeEnv: process.env.NODE_ENV ?? 'unknown',
          vercel: Boolean(process.env.VERCEL),
          vercelEnv: process.env.VERCEL_ENV ?? null,
          databaseUrl: getUrlShape(process.env.DATABASE_URL),
          directUrl: getUrlShape(process.env.DIRECT_URL),
          authSecretPresent: Boolean(process.env.AUTH_SECRET),
          nextAuthSecretPresent: Boolean(process.env.NEXTAUTH_SECRET),
          nextAuthUrlPresent: Boolean(process.env.NEXTAUTH_URL),
          authUrlPresent: Boolean(process.env.AUTH_URL),
          jwtSecretPresent: Boolean(process.env.JWT_SECRET),
        },
        error: formatError(error),
        hint: getDatabaseConfigHint(),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  }
}
