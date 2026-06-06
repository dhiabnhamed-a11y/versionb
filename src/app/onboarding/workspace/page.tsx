import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import WorkspacePickerClient from '@/components/billing/WorkspacePickerClient'

export const metadata: Metadata = {
  title: 'Choose Workspace | TASKIT',
  robots: { follow: false, index: false },
}

export default async function OnboardingWorkspacePage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  return <WorkspacePickerClient />
}
