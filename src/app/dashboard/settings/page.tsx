import { redirect } from 'next/navigation'

import { auth, getSessionHomePath } from '@/lib/auth'
import {
  canManageSettings,
  getSettingsTeamUsers,
  getWorkspaceThemeSettings,
  type SettingsSessionUser,
} from '@/lib/settings'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login')
  }

  const user = session.user as SettingsSessionUser
  if (!canManageSettings(user.role)) {
    redirect(getSessionHomePath(session))
  }

  if (!user.companyId || !user.id) {
    redirect(getSessionHomePath(session))
  }

  const [appearance, teamUsers] = await Promise.all([
    getWorkspaceThemeSettings(user.companyId),
    getSettingsTeamUsers(user.companyId, user.id),
  ])

  return (
    <SettingsClient
      initialAppearance={appearance}
      initialUsers={teamUsers}
      currentUser={{
        id: user.id,
        role: user.role === 'OWNER' ? 'OWNER' : 'MANAGER',
      }}
    />
  )
}
