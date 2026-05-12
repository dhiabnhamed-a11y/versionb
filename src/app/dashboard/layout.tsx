import { redirect } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'
import { getUserDashboardDesignSettings, getUserLanguageSettings, getWorkspaceThemeSettings } from '@/lib/settings'
import DashboardLayout from './layout-client'

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  const [initialThemeSettings, initialUserDesign, initialLanguage] = await Promise.all([
    getWorkspaceThemeSettings(session.user.companyId),
    getUserDashboardDesignSettings(session.user.id),
    getUserLanguageSettings(session.user.id),
  ])

  return (
    <SessionProvider>
      <DashboardLayout
        initialThemeSettings={initialThemeSettings}
        initialUserDesign={initialUserDesign}
        initialLocale={initialLanguage.locale}
      >
        {children}
      </DashboardLayout>
    </SessionProvider>
  )
}
