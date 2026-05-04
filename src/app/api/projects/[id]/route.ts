import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import { getProjectIfAllowed } from '@/lib/project-access'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { getProjectCameraSupport, withProjectCameraDefaults } from '@/lib/project-camera-support'
import { normalizeCompanyType } from '@/lib/company-types'
import { getProjectMediaSupport } from '@/lib/project-media-support'
import {
  attachProjectAgencyFields,
  findProjectCategory,
  getProjectCategorySupport,
  updateProjectAgencyFields,
} from '@/lib/project-category-support'

type SessionUser = {
  id: string
  role: string
  companyId?: string | null
  companyType?: string | null
}

type UpdateProjectBody = {
  title?: string
  description?: string | null
  roomId?: string | null
  categoryId?: string | null
  clientName?: string | null
  managerId?: string | null
  hasCamera?: boolean
  cameraType?: 'device' | 'external'
}

function canManageWorkspace(user: SessionUser) {
  return user.role !== 'EMPLOYEE'
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  const { id } = await params

  const allowed = await getProjectIfAllowed(id, user)
  if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const support = await getProjectCameraSupport()
  const mediaSupport = await getProjectMediaSupport()
  const isAgency = normalizeCompanyType(user.companyType) === 'DIGITAL_AGENCY'
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
              ...(mediaSupport.hasTaskSubmissionCloudinaryColumns
                ? {
                    mediaType: true,
                    fileSize: true,
                    duration: true,
                    thumbnailUrl: true,
                    playbackUrl: true,
                    cloudinaryPublicId: true,
                  }
                : {}),
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
      ...(isAgency && mediaSupport.hasProjectMediaTable
        ? {
            projectMedia: {
              orderBy: { createdAt: 'desc' },
              take: 24,
              select: {
                id: true,
                projectId: true,
                url: true,
                playbackUrl: true,
                thumbnailUrl: true,
                cloudinaryPublicId: true,
                type: true,
                mimeType: true,
                originalFilename: true,
                size: true,
                duration: true,
                width: true,
                height: true,
                format: true,
                createdAt: true,
                uploadedBy: { select: { id: true, name: true } },
              },
            },
          }
        : {}),
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [projectWithAgencyFields] = await attachProjectAgencyFields([withProjectCameraDefaults(project)], user.companyId!)

  return NextResponse.json(
    {
      ...projectWithAgencyFields,
      cameraMedia: 'cameraMedia' in project ? project.cameraMedia : [],
      projectMedia: isAgency && 'projectMedia' in project ? project.projectMedia : [],
    },
    { headers: NO_STORE_HEADERS }
  )
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (!canManageWorkspace(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const allowed = await getProjectIfAllowed(id, user)
  if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as UpdateProjectBody
  const support = await getProjectCameraSupport()
  const updatesCamera = typeof body.hasCamera === 'boolean' || body.cameraType !== undefined
  if (updatesCamera && (!support.hasCameraColumns || !support.hasCameraTypeEnum)) {
    return NextResponse.json(
      { error: 'Project camera settings are not ready. Apply the latest database migration first.' },
      { status: 503 }
    )
  }

  const title = body.title?.trim()
  const description = body.description === undefined ? undefined : body.description?.trim() || null
  const roomId = body.roomId === undefined ? undefined : body.roomId?.trim() || null
  const categoryId = body.categoryId === undefined ? undefined : body.categoryId?.trim() || null
  const clientName = body.clientName === undefined ? undefined : body.clientName?.trim() || null
  const managerId = body.managerId === undefined ? undefined : body.managerId?.trim() || null

  if (body.title !== undefined && !title) {
    return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })
  }

  const existingProject = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, categoryId: true },
  })
  if (!existingProject) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (roomId) {
    const room = await prisma.room.findFirst({
      where: { id: roomId, companyId: user.companyId },
      select: { id: true },
    })
    if (!room) return NextResponse.json({ error: 'Selected room was not found in this workspace.' }, { status: 404 })
  }

  if (managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: managerId, companyId: user.companyId },
      select: { id: true },
    })
    if (!manager) return NextResponse.json({ error: 'Selected manager was not found in this workspace.' }, { status: 404 })
  }

  const categorySupport = await getProjectCategorySupport()
  if (categoryId) {
    if (normalizeCompanyType(user.companyType) !== 'DIGITAL_AGENCY') {
      return NextResponse.json({ error: 'Categories are only available for digital agency workspaces.' }, { status: 403 })
    }

    if (!categorySupport.hasCategoryTable || !categorySupport.hasProjectCategoryColumns) {
      return NextResponse.json(
        { error: 'Project categories are not ready. Apply the latest database migration first.' },
        { status: 503 }
      )
    }

    const category = await findProjectCategory(user.companyId, categoryId)
    if (!category) return NextResponse.json({ error: 'Selected category was not found in this workspace.' }, { status: 404 })
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(roomId !== undefined ? { roomId } : {}),
      ...(managerId !== undefined ? { managerId } : {}),
      ...(typeof body.hasCamera === 'boolean' ? { hasCamera: body.hasCamera } : {}),
      ...(body.cameraType ? { cameraType: body.cameraType === 'external' ? 'external' : 'device' } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      roomId: true,
      managerId: true,
      createdAt: true,
      updatedAt: true,
      ...(support.hasCameraColumns ? { hasCamera: true, cameraType: true } : {}),
      room: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
      tasks: { select: { id: true, stage: true, priority: true } },
    },
  })

  if (categoryId !== undefined || clientName !== undefined) {
    await updateProjectAgencyFields({
      projectId: id,
      companyId: user.companyId,
      categoryId: categoryId !== undefined ? categoryId : existingProject.categoryId,
      clientName,
    })
  }

  const normalizedProject = withProjectCameraDefaults(project)
  const [projectWithAgencyFields] = await attachProjectAgencyFields([normalizedProject], user.companyId)
  emitCompanyRealtime(user.companyId, 'project_updated', { project: projectWithAgencyFields, projectId: id })

  return NextResponse.json(projectWithAgencyFields)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (!canManageWorkspace(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
    select: {
      id: true,
      tasks: { select: { id: true } },
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const taskIds = project.tasks.map((task) => task.id)

  await prisma.$transaction(async (tx) => {
    if (taskIds.length > 0) {
      await tx.activity.deleteMany({ where: { taskId: { in: taskIds } } })
      await tx.taskSubmission.deleteMany({ where: { taskId: { in: taskIds } } })
      await tx.calendarEvent.deleteMany({
        where: {
          OR: [{ taskId: { in: taskIds } }, { projectId: id }],
        },
      })
      await tx.task.deleteMany({ where: { id: { in: taskIds } } })
    } else {
      await tx.calendarEvent.deleteMany({ where: { projectId: id } })
    }

    await tx.projectCamera.deleteMany({ where: { projectId: id } })
    await tx.projectCameraMedia.deleteMany({ where: { projectId: id } })
    await tx.project.delete({ where: { id } })
  })

  emitCompanyRealtime(user.companyId, 'project_deleted', { projectId: id })

  return NextResponse.json({ success: true })
}
