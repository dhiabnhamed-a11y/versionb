import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getProjectIfAllowed } from '@/lib/project-access'
import { getProjectCameraSupport } from '@/lib/project-camera-support'

/** GET /api/projects/:id/camera — list captured media for a project */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser()
  const { id: projectId } = await params

  const project = await getProjectIfAllowed(projectId, user)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!project.hasCamera) {
    return NextResponse.json({ error: 'Camera is not enabled for this project' }, { status: 403 })
  }

  const support = await getProjectCameraSupport()
  if (!support.hasCameraMediaTable) {
    return NextResponse.json([])
  }

  const media = await prisma.projectCameraMedia.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(media)
}
