import { redirect } from 'next/navigation'

import LegalAdminClient from '@/components/legal/LegalAdminClient'
import { auth, getSessionHomePath } from '@/lib/auth'
import { canAuthenticateAuthState, isAuthorizedSuperAdminIdentity } from '@/lib/security'

export default async function SuperAdminLegalPage() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  if (!canAuthenticateAuthState(session.user)) {
    redirect('/login?reason=inactive')
  }

  if (!isAuthorizedSuperAdminIdentity(session.user)) {
    redirect(getSessionHomePath(session))
  }

  return <LegalAdminClient />
}

