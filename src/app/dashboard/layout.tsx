import { redirect } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'
import { isHealthcareCompanyType, normalizeCompanyType } from '@/lib/company-types'
import { getUserDashboardDesignSettings, getUserLanguageSettings, getWorkspaceThemeSettings } from '@/lib/settings'
import DashboardLayout from './layout-client'
import HealthcareSidebar from '@/components/healthcare/HealthcareSidebar'
import { LocaleProvider } from '@/components/i18n/LocaleProvider'
import WorkspaceThemeProvider from '@/components/dashboard/WorkspaceThemeProvider'
import AlertReceiver from '@/components/alerts/AlertReceiver'
import AiOperationsAssistant from '@/components/dashboard/AiOperationsAssistant'
import PushNotificationBootstrap from '@/components/pwa/PushNotificationBootstrap'

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

  const companyType = normalizeCompanyType(session.user.companyType)
  const isHealthcare = isHealthcareCompanyType(companyType)
  const isSuperAdmin = session.user.role === 'SUPER_ADMIN'

  // Healthcare workspaces get a completely different shell
  if (isHealthcare && !isSuperAdmin) {
    return (
      <SessionProvider>
        <LocaleProvider initialLocale={initialLanguage.locale}>
          <WorkspaceThemeProvider settings={initialThemeSettings} userDesign={initialUserDesign} />
          <PushNotificationBootstrap userId={session.user.id} />
          <HealthcareSidebar initialLocale={initialLanguage.locale}>
            {children}
          </HealthcareSidebar>
          <AlertReceiver userId={session.user.id} />
          <AiOperationsAssistant disabled={false} />
        </LocaleProvider>
      </SessionProvider>
    )
  }

  // Standard layout for all other workspace types
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
