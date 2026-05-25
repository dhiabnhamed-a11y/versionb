import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isErpWorkspaceType } from '@/lib/company-types'

export default async function HrPage() {
  const session = await auth()
  redirect(isErpWorkspaceType(session?.user?.companyType) ? '/erp/hr' : '/dashboard/admin/employees')
}
