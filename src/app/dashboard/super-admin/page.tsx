import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import SuperAdminCompaniesClient from '@/components/super-admin/SuperAdminCompaniesClient'
import { canAuthenticateAuthState, getRoleHomePath, isAuthorizedSuperAdminIdentity } from '@/lib/security'

export default async function SuperAdminDashboardPage(props: PageProps<'/dashboard/super-admin'>) {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  if (!canAuthenticateAuthState(session.user)) {
    redirect('/login?reason=inactive')
  }

  if (!isAuthorizedSuperAdminIdentity(session.user)) {
    redirect(getRoleHomePath(session.user.role, session.user.companyType))
  }

  const searchParams = await props.searchParams
  const status = Array.isArray(searchParams.status) ? searchParams.status[0] : searchParams.status

  return <SuperAdminCompaniesClient initialStatus={status ?? 'PENDING'} />
}
