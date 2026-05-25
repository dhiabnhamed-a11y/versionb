import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { canAuthenticateAuthState } from '@/lib/security'
import { getWorkspaceRouteRedirect } from '@/lib/workspace-routing'

export default async function EmployeeWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  if (!canAuthenticateAuthState(session.user)) {
    redirect('/login?reason=inactive')
  }

  const routeRedirect = getWorkspaceRouteRedirect('/dashboard/employee', session.user)
  if (routeRedirect) {
    redirect(routeRedirect.destination)
  }

  return children
}
