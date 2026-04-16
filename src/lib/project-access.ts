import { prisma } from '@/lib/db'

export type SessionUser = {
  id: string
  role: string
  companyId?: string | null
}

/**
 * Project is visible if it belongs to the user's company.
 * Camera/upload: OWNER & MANAGER always; EMPLOYEE only if assigned a task on the project.
 */
export async function getProjectIfAllowed(projectId: string, user: SessionUser) {
  if (!user.companyId) return null

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
  })
  if (!project) return null

  if (user.role === 'OWNER' || user.role === 'MANAGER') {
    return project
  }

  if (user.role === 'EMPLOYEE') {
    const assignedHere = await prisma.task.findFirst({
      where: { projectId, assigneeId: user.id },
    })
    if (!assignedHere) return null
  }

  return project
}
