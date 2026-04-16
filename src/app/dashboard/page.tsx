import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function DashboardIndexPage() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  const role = (session.user as { role?: string }).role
  redirect(role === 'EMPLOYEE' ? '/dashboard/employee' : '/dashboard/admin')
}
