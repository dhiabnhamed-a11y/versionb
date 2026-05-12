import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/db'
import {
  canAuthenticateAuthState,
  getAuthBlockReason,
  getRoleHomePath,
  isAuthorizedSuperAdminIdentity,
} from '@/lib/security'

type AuthUserRecord = {
  id: string
  name: string
  email: string
  password: string
  role: string
  accountStatus: string
  companyId: string | null
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

async function loadAuthUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
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
  const user = await loadAuthUserByEmail(email)
  if (!user) {
    return { ok: false as const, error: 'Invalid email or password.' }
  }

  const isValidPassword = await bcrypt.compare(password, user.password)
  if (!isValidPassword) {
    return { ok: false as const, error: 'Invalid email or password.' }
  }

  const authUser = buildAuthSessionUser(user)
  if (!canAuthenticateAuthState(authUser)) {
    return { ok: false as const, error: getAuthBlockReason(authUser) }
  }

  return { ok: true as const, user: authUser }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const result = await validateCredentialsForLogin(credentials.email as string, credentials.password as string)
        if (!result.ok) {
          return null
        }

        return result.user
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

      if (token.id) {
        const freshUser = await loadAuthUserById(token.id as string)
        if (!freshUser) {
          return {}
        }

        const authUser = buildAuthSessionUser(freshUser)
        token.email = freshUser.email
        token.role = authUser.role
        token.accountStatus = authUser.accountStatus
        token.companyId = authUser.companyId
        token.preferredLocale = authUser.preferredLocale
        token.companyType = authUser.companyType
        token.companyStatus = authUser.companyStatus
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
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'taskforce-super-secret-key-2024-change-in-production',
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
