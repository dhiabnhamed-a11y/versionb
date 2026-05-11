import { auth } from '@/lib/auth'
import { unauthorized } from '@/modules/shared/errors'

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
  return session.user as SessionUser
}

export function requireCompanyId(user: SessionUser) {
  if (!user.companyId) return null
  return user.companyId
}
