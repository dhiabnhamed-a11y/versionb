import { redirect } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'
import { normalizeCompanyType, isErpWorkspaceType } from '@/lib/company-types'
import { ERPShell } from '@/components/erp/ERPShell'

export default async function ERPRootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  const companyType = normalizeCompanyType(session.user.companyType)

  if (!isErpWorkspaceType(companyType)) {
    redirect('/dashboard')
  }

  return (
    <SessionProvider>
      <ERPShell companyId={session.user.companyId!}>{children}</ERPShell>
    </SessionProvider>
  )
}
