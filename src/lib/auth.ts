import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'crypto'

import { prisma } from '@/lib/db'
import { getAuthSecret } from '@/lib/env'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import {
  canAuthenticateAuthState,
  getAuthBlockReason,
  getRoleHomePath,
  isAuthorizedSuperAdminIdentity,
} from '@/lib/security'
import { logger } from '@/modules/shared/logger'
import { assertLoginNotLocked } from '@/lib/security/brute-force'

type AuthUserRecord = {
  id: string
  name: string
  email: string
  password: string
  role: string
  accountStatus: string
  companyId: string | null
  authUserId: string | null
  preferredLocale: string
  company: {
    companyType: string
    status: string
  } | null
}

type AuthSessionShape = {
  id: string
  name: string
  email: string
  role: string
  accountStatus: string
  companyId: string | null
  preferredLocale: string
  companyType: string | null
  companyStatus: string | null
}

type SupabasePasswordVerification =
  | {
      ok: true
      authUserId: string | null
    }
  | {
      ok: false
      reason: string
    }

async function loadAuthUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: {
      company: {
        select: {
          companyType: true,
          status: true,
        },
      },
    },
  }) as Promise<AuthUserRecord | null>
}

async function verifyPasswordWithSupabase(email: string, password: string): Promise<SupabasePasswordVerification> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, reason: 'missing_supabase_config' }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error || !data.user) {
    return { ok: false, reason: error?.message ?? 'supabase_user_missing' }
  }

  return { ok: true, authUserId: data.user.id ?? null }
}

async function repairPrismaPasswordHash(user: AuthUserRecord, password: string, authUserId: string | null) {
  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: passwordHash,
      authUserId: user.authUserId ?? authUserId ?? undefined,
    },
  })
}

function getSafeAuthLogContext(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const [, domain = 'unknown'] = normalizedEmail.split('@')

  return {
    emailDomain: domain,
    emailLength: normalizedEmail.length,
  }
}

function hashLoginEmail(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

async function recordLoginAttempt(email: string, success: boolean, reason?: string) {
  try {
    await prisma.$executeRaw`
      INSERT INTO "auth_login_attempts" ("id", "emailHash", "success", "reason", "riskScore", "createdAt")
      VALUES (${randomUUID()}, ${hashLoginEmail(email)}, ${success}, ${reason ?? null}, ${success ? 0 : 50}, NOW())
    `
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) return
    logger.warn('auth.login_attempt_record_failed', { reason: error instanceof Error ? error.message : 'unknown' })
  }
}

function buildAuthSessionUser(user: AuthUserRecord): AuthSessionShape {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    companyId: user.companyId,
    preferredLocale: user.preferredLocale,
    companyType: user.company?.companyType ?? null,
    companyStatus: user.company?.status ?? null,
  }
}

export async function validateCredentialsForLogin(email: string, password: string) {
  await assertLoginNotLocked(email)
  const logContext = getSafeAuthLogContext(email)
  const user = await loadAuthUserByEmail(email)
  if (!user) {
    logger.warn('auth.credentials_rejected', { ...logContext, reason: 'user_not_found' })
    await recordLoginAttempt(email, false, 'user_not_found')
    return { ok: false as const, error: 'Invalid email or password.' }
  }

  const isValidPrismaPassword = await bcrypt.compare(password, user.password)
  if (!isValidPrismaPassword) {
    const supabaseVerification = await verifyPasswordWithSupabase(email, password)
    if (!supabaseVerification.ok) {
      logger.warn('auth.credentials_rejected', {
        ...logContext,
        reason: 'password_mismatch',
        supabaseFallback: supabaseVerification.reason,
        userId: user.id,
        role: user.role,
        accountStatus: user.accountStatus,
        companyStatus: user.company?.status ?? null,
        passwordHashPresent: Boolean(user.password),
        passwordHashLength: user.password?.length ?? 0,
      })
      await recordLoginAttempt(email, false, 'password_mismatch')
      return { ok: false as const, error: 'Invalid email or password.' }
    }

    await repairPrismaPasswordHash(user, password, supabaseVerification.authUserId)
    logger.warn('auth.prisma_password_hash_repaired', {
      ...logContext,
      userId: user.id,
      role: user.role,
      accountStatus: user.accountStatus,
      companyStatus: user.company?.status ?? null,
      authUserIdRepaired: !user.authUserId && Boolean(supabaseVerification.authUserId),
    })
  }

  const authUser = buildAuthSessionUser(user)
  if (!canAuthenticateAuthState(authUser)) {
    logger.warn('auth.credentials_blocked', {
      ...logContext,
      userId: user.id,
      role: user.role,
      accountStatus: user.accountStatus,
      companyStatus: user.company?.status ?? null,
    })
    await recordLoginAttempt(email, false, 'blocked_state')
    return { ok: false as const, error: getAuthBlockReason(authUser) }
  }

  logger.info('auth.credentials_accepted', {
    ...logContext,
    userId: user.id,
    role: user.role,
    accountStatus: user.accountStatus,
    companyStatus: user.company?.status ?? null,
  })
  await recordLoginAttempt(email, true)

  return { ok: true as const, user: authUser }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const result = await validateCredentialsForLogin(credentials.email as string, credentials.password as string)
          if (!result.ok) {
            return null
          }

          return result.user
        } catch (error) {
          logger.error('auth.credentials_authorize_failed', error, getSafeAuthLogContext(credentials.email as string))
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.role = (user as AuthSessionShape).role
        token.accountStatus = (user as AuthSessionShape).accountStatus
        token.companyId = (user as AuthSessionShape).companyId
        token.preferredLocale = (user as AuthSessionShape).preferredLocale
        token.companyType = (user as AuthSessionShape).companyType
        token.companyStatus = (user as AuthSessionShape).companyStatus
        return token
      }

      return token
    },
    session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        ;(session.user as AuthSessionShape).role = token.role as string
        ;(session.user as AuthSessionShape).accountStatus = token.accountStatus as string
        ;(session.user as AuthSessionShape).companyId = token.companyId as string | null
        ;(session.user as AuthSessionShape).preferredLocale = token.preferredLocale as string
        ;(session.user as AuthSessionShape).companyType = token.companyType as string | null
        ;(session.user as AuthSessionShape).companyStatus = token.companyStatus as string | null
      }

      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 15,
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  secret: getAuthSecret(),
})

export function getSessionHomePath(session: { user?: { role?: string | null } | null }) {
  return getRoleHomePath(session.user?.role)
}

export function isSuperAdminSession(session: { user?: { email?: string | null; role?: string | null } | null }) {
  return isAuthorizedSuperAdminIdentity({
    email: session.user?.email,
    role: session.user?.role,
  })
}
