import { redirect } from 'next/navigation'

import { auth, getSessionHomePath } from '@/lib/auth'
import { isErpWorkspaceType } from '@/lib/company-types'
import {
  canManageSettings,
  getSettingsTeamUsers,
  getUserDashboardDesignSettings,
  getWorkspaceThemeSettings,
  type SettingsSessionUser,
} from '@/lib/settings'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login')
  }

  if (isErpWorkspaceType(session.user.companyType)) {
    redirect('/erp/settings')
  }

  const user = session.user as SettingsSessionUser
  if (!user.id) {
    redirect(getSessionHomePath(session))
  }

  const canManageWorkspace = canManageSettings(user.role)
  const [appearance, personalDesign, teamUsers] = await Promise.all([
    getWorkspaceThemeSettings(user.companyId),
    getUserDashboardDesignSettings(user.id),
    canManageWorkspace && user.companyId ? getSettingsTeamUsers(user.companyId, user.id) : Promise.resolve([]),
  ])

  return (
    <SettingsClient
      initialAppearance={appearance}
      initialDesign={personalDesign}
      initialUsers={teamUsers}
      currentUser={
        canManageWorkspace
          ? {
              id: user.id,
              role: user.role === 'OWNER' ? 'OWNER' : 'MANAGER',
            }
          : null
      }
      canManageWorkspace={canManageWorkspace}
    />
  )
}
