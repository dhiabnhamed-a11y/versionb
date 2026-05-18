import { apiRoute } from '@/lib/api/handler'
import { revokeAllUserSessions } from '@/lib/security/session-revocation'
import { signOut } from '@/lib/auth'

export const POST = apiRoute(async ({ user }) => {
  await revokeAllUserSessions(user.id, 'user_requested_logout_all')
  await signOut({ redirect: false })
  return { revoked: true }
}, { auth: 'required' })
