import { DM_Sans, Syne } from 'next/font/google'
import TaskitLandingPage from '@/components/landing/TaskitLandingPage'
import { auth } from '@/lib/auth'
import { getRoleHomePath } from '@/lib/security'

const syne = Syne({
  subsets: ['latin'],
  display: 'swap',
  variable: '--taskit-landing-display',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--taskit-landing-body',
})

export default async function HomePage() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role

  return (
    <div className={`${syne.variable} ${dmSans.variable}`}>
      <TaskitLandingPage
        dashboardHref={getRoleHomePath(role)}
        isSignedIn={Boolean(session?.user?.email)}
      />
    </div>
  )
}
