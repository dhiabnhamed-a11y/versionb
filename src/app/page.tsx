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
      <div className="sr-only" aria-hidden="false">
        <h1>TASKIT OS — All-in-One Agency Operations Platform</h1>
        <p>
          TASKIT OS replaces project management, CRM, billing, client portal, and reporting tools 
          with one unified platform. Manage projects, clients, invoices, contracts, AI automation, 
          and real-time team collaboration — all in one place.
        </p>
        <h2>Key Features</h2>
        <ul>
          <li>Project and task management with Kanban boards</li>
          <li>Client portal with token-based secure access</li>
          <li>Invoicing and billing with Stripe and Dodo Payments</li>
          <li>AI-powered workflow automation and insights</li>
          <li>Real-time collaboration with Socket.IO presence</li>
          <li>Double-entry accounting and financial operations</li>
          <li>Contract management with AI generation and e-signatures</li>
          <li>Enterprise-grade security with MFA and RBAC</li>
          <li>Multi-language support for English, French, and Arabic</li>
        </ul>
        <h2>Pricing</h2>
        <p>Start free with a 14-day trial. Starter at $19/month per user. Team at $39/month per user. Custom Enterprise pricing available.</p>
        <h2>Use Cases</h2>
        <ul>
          <li>Agency operations and workflow management</li>
          <li>Creative team collaboration and client approvals</li>
          <li>Financial management and agency billing</li>
          <li>Enterprise ITSM and asset management</li>
        </ul>
      </div>
      <TaskitLandingPage
        dashboardHref={getRoleHomePath(user?.role, user?.companyType)}
        isSignedIn={Boolean(session?.user?.email)}
        liveStats={liveStats}
      />
    </div>
  )
}
