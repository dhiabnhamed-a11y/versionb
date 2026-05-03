import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getProjectIfAllowed } from '@/lib/project-access'
import { getProjectCameraSupport, withProjectCameraDefaults } from '@/lib/project-camera-support'
import { attachProjectAgencyFields } from '@/lib/project-category-support'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string; companyId?: string | null }
  const { id } = await params

  const allowed = await getProjectIfAllowed(id, user)
  if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const support = await getProjectCameraSupport()
  const project = await prisma.project.findFirst({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      companyId: true,
      managerId: true,
      createdAt: true,
      updatedAt: true,
      ...(support.hasCameraColumns ? { hasCamera: true, cameraType: true } : {}),
      room: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
      tasks: {
        select: {
          id: true,
          stage: true,
          title: true,
          deliverableType: true,
          submissions: {
            orderBy: { createdAt: 'desc' },
            take: 4,
            select: {
              id: true,
              fileUrl: true,
              fileName: true,
              fileType: true,
              note: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      ...(support.hasCameraMediaTable
        ? {
            cameraMedia: { orderBy: { createdAt: 'desc' }, take: 12 },
          }
        : {}),
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [projectWithAgencyFields] = await attachProjectAgencyFields([withProjectCameraDefaults(project)], user.companyId!)

  return NextResponse.json({
    ...projectWithAgencyFields,
    cameraMedia: 'cameraMedia' in project ? project.cameraMedia : [],
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string; companyId?: string | null }
  if (user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const allowed = await getProjectIfAllowed(id, user)
  if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const support = await getProjectCameraSupport()
  if (!support.hasCameraColumns || !support.hasCameraTypeEnum) {
    return NextResponse.json(
      { error: 'Project camera settings are not ready. Apply the latest database migration first.' },
      { status: 503 }
    )
  }

  const body = (await req.json().catch(() => ({}))) as {
    hasCamera?: boolean
    cameraType?: 'device' | 'external'
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(typeof body.hasCamera === 'boolean' ? { hasCamera: body.hasCamera } : {}),
      ...(body.cameraType ? { cameraType: body.cameraType === 'external' ? 'external' : 'device' } : {}),
    },
    select: {
      id: true,
      hasCamera: true,
      cameraType: true,
    },
  })

  return NextResponse.json(withProjectCameraDefaults(project))
}
