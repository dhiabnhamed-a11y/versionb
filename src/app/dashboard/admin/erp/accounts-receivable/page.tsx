import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isErpWorkspaceType } from '@/lib/company-types'

export default async function AccountsReceivablePage() {
  const session = await auth()
  redirect(isErpWorkspaceType(session?.user?.companyType) ? '/erp/accounts-receivable' : '/dashboard/admin/finance')
}
