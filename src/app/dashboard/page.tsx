import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canAuthenticateAuthState, getRoleHomePath } from '@/lib/security'

export default async function DashboardIndexPage() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  if (!canAuthenticateAuthState(session.user)) {
    redirect('/login?reason=inactive')
  }

  redirect(getRoleHomePath(session.user.role, session.user.companyType))
}
