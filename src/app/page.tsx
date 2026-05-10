import AgencyOperationsExperience from '@/components/agency-os/AgencyOperationsExperience'
import { auth } from '@/lib/auth'
import { getRoleHomePath } from '@/lib/security'

export default async function HomePage() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role

  return (
    <AgencyOperationsExperience
      dashboardHref={getRoleHomePath(role)}
      isSignedIn={Boolean(session?.user?.email)}
    />
  )
}
