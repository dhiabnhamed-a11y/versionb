import { redirect } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'
import { getWorkspaceThemeSettings } from '@/lib/settings'
import DashboardLayout from './layout-client'

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  const initialThemeSettings = await getWorkspaceThemeSettings(session.user.companyId)

  return (
    <SessionProvider>
      <DashboardLayout initialThemeSettings={initialThemeSettings}>{children}</DashboardLayout>
    </SessionProvider>
  )
}
