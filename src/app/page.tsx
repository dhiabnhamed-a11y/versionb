import TaskitLandingPage from '@/components/landing/TaskitLandingPage'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getRoleHomePath } from '@/lib/security'

async function getLandingStats() {
  try {
    const [companies, users, projects, tasks] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.project.count(),
      prisma.task.count(),
    ])

    const formatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

    return [
      { value: formatter.format(companies), label: 'Registered workspaces' },
      { value: formatter.format(users), label: 'Workspace members' },
      { value: formatter.format(projects), label: 'Projects & campaigns' },
      { value: formatter.format(tasks), label: 'Tasks in TASKIT' },
    ]
  } catch {
    return []
  }
}

export default async function HomePage() {
  const [session, liveStats] = await Promise.all([auth(), getLandingStats()])
  const user = session?.user as { role?: string; companyType?: string | null } | undefined

  return (
    <div>
      <TaskitLandingPage
        dashboardHref={getRoleHomePath(user?.role, user?.companyType)}
        isSignedIn={Boolean(session?.user?.email)}
        liveStats={liveStats}
      />
    </div>
  )
}
