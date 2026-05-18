import { prisma } from '@/lib/db'
import { getProjectCameraSupport, withProjectCameraDefaults } from '@/lib/project-camera-support'

export type SessionUser = {
  id: string
  role?: string | null
  companyId?: string | null
}

/**
 * Project is visible if it belongs to the user's company.
 * Camera/upload: OWNER & MANAGER always; EMPLOYEE only if assigned a task on the project.
 */
export async function getProjectIfAllowed(projectId: string, user: SessionUser) {
  if (!user.companyId) return null

  const support = await getProjectCameraSupport()
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
    select: {
      id: true,
      title: true,
      description: true,
      companyId: true,
      managerId: true,
      createdAt: true,
      updatedAt: true,
      ...(support.hasCameraColumns ? { hasCamera: true, cameraType: true } : {}),
    },
  })
  if (!project) return null

  if (user.role === 'OWNER' || user.role === 'MANAGER') {
    return withProjectCameraDefaults(project)
  }

  if (user.role === 'EMPLOYEE') {
    const assignedHere = await prisma.task.findFirst({
      where: { projectId, assigneeId: user.id },
    })
    if (!assignedHere) return null
  }

  return withProjectCameraDefaults(project)
}
