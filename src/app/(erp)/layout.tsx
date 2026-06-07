import { redirect } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'
import { normalizeCompanyType, isErpWorkspaceType } from '@/lib/company-types'
import { getWorkspaceHomePath } from '@/lib/workspace-routing'
import { ERPShell } from '@/components/erp/ERPShell'
import { prisma } from '@/lib/db'
import { ensureErpWorkspaceInitialized } from '@/services/erp2/setup.service'
import { LocaleProvider } from '@/components/i18n/LocaleProvider'
import { getUserLanguageSettings } from '@/lib/settings'

export default async function ERPRootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  const companyType = normalizeCompanyType(session.user.companyType)

  if (!isErpWorkspaceType(companyType)) {
    redirect(getWorkspaceHomePath(session.user))
  }

  if (session.user.companyId) {
    await prisma.$transaction((tx) => ensureErpWorkspaceInitialized(tx, session.user.companyId!))
  }

  const initialLanguage = await getUserLanguageSettings(session.user.id)

  return (
    <SessionProvider>
      <LocaleProvider initialLocale={initialLanguage.locale}>
        <ERPShell>{children}</ERPShell>
      </LocaleProvider>
    </SessionProvider>
  )
}
