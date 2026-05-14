import { auth } from '@/lib/auth'
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

export async function requireSessionUser() {
  const session = await auth()
  if (!session?.user) throw unauthorized()
  const user = session.user as SessionUser

  const hasStatusSnapshot = Boolean(user.accountStatus || user.companyStatus)
  if (hasStatusSnapshot && !canAuthenticateAuthState(user)) {
    throw forbidden(getAuthBlockReason(user))
  }

  return user
}

export function requireCompanyId(user: SessionUser) {
  if (!user.companyId) return null
  return user.companyId
}
