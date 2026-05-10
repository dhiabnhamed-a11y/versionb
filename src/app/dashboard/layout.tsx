import { redirect } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'
import { getUserDashboardDesignSettings, getWorkspaceThemeSettings } from '@/lib/settings'
import DashboardLayout from './layout-client'

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  const [initialThemeSettings, initialUserDesign] = await Promise.all([
    getWorkspaceThemeSettings(session.user.companyId),
    getUserDashboardDesignSettings(session.user.id),
  ])

  return (
    <SessionProvider>
      <DashboardLayout initialThemeSettings={initialThemeSettings} initialUserDesign={initialUserDesign}>
        {children}
      </DashboardLayout>
    </SessionProvider>
  )
}
