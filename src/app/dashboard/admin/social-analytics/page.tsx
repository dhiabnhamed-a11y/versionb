import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isContentCreationCompanyType, normalizeCompanyType } from '@/lib/company-types'
import SocialAnalyticsClient from '@/components/integrations/SocialAnalyticsClient'

type SessionUser = {
  role?: string | null
  companyId?: string | null
  companyType?: string | null
}

export default async function SocialAnalyticsPage() {
  const session = await auth()
  const user = session?.user as SessionUser | undefined

  if (!user?.companyId) redirect('/dashboard/admin')
  if (user.role === 'EMPLOYEE') redirect('/dashboard/employee')
  if (!isContentCreationCompanyType(normalizeCompanyType(user.companyType))) redirect('/dashboard/admin')

  return <SocialAnalyticsClient />
}
