import { redirect } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'
import DashboardLayout from './layout-client'

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  return (
    <SessionProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </SessionProvider>
  )
}
