import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function HomePage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')
  const role = (session.user as { id?: string, role?: string; companyId?: string })?.role
  if (role === 'EMPLOYEE') redirect('/dashboard/employee')
  redirect('/dashboard/admin')
}
