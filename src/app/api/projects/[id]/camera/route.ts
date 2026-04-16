import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getProjectIfAllowed } from '@/lib/project-access'

/** GET /api/projects/:id/camera — list captured media for a project */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string; companyId?: string | null }
  const { id: projectId } = await params

  const project = await getProjectIfAllowed(projectId, user)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!project.hasCamera) {
    return NextResponse.json({ error: 'Camera is not enabled for this project' }, { status: 403 })
  }

  const media = await prisma.projectCameraMedia.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(media)
}
