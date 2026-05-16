import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAuthenticateAuthState, getAuthBlockReason } from '@/lib/security'
import { forbidden, unauthorized } from '@/modules/shared/errors'

export type SessionUser = {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
  companyId?: string | null
  companyType?: string | null
  companyStatus?: string | null
  accountStatus?: string | null
}

function sameNullable(left?: string | null, right?: string | null) {
  return (left ?? null) === (right ?? null)
}

export async function requireSessionUser() {
  const session = await auth()
  if (!session?.user) throw unauthorized()
  const user = session.user as SessionUser

  const liveUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accountStatus: true,
      companyId: true,
      company: {
        select: {
          companyType: true,
          status: true,
        },
      },
    },
  })

  if (!liveUser) throw unauthorized()

  const currentUser: SessionUser = {
    id: liveUser.id,
    name: liveUser.name,
    email: liveUser.email,
    role: liveUser.role,
    accountStatus: liveUser.accountStatus,
    companyId: liveUser.companyId,
    companyType: liveUser.company?.companyType ?? null,
    companyStatus: liveUser.company?.status ?? null,
  }

  if (!canAuthenticateAuthState(currentUser)) {
    throw forbidden(getAuthBlockReason(currentUser))
  }

  if (
    !sameNullable(user.role, currentUser.role) ||
    !sameNullable(user.companyId, currentUser.companyId) ||
    !sameNullable(user.accountStatus, currentUser.accountStatus) ||
    !sameNullable(user.companyStatus, currentUser.companyStatus)
  ) {
    throw unauthorized('Session is stale. Please sign in again.')
  }

  return currentUser
}

export function requireCompanyId(user: SessionUser) {
  if (!user.companyId) return null
  return user.companyId
}
