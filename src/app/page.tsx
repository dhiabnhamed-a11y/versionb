import TaskitLandingPage from '@/components/landing/TaskitLandingPage'
import { auth } from '@/lib/auth'
import { getRoleHomePath } from '@/lib/security'

export default async function HomePage() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role

  return (
    <div>
      <TaskitLandingPage
        dashboardHref={getRoleHomePath(role)}
        isSignedIn={Boolean(session?.user?.email)}
      />
    </div>
  )
}
