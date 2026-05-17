import { isAgencyCompanyType, normalizeCompanyType } from '@/lib/company-types'
import { ensureImportedBriefForCampaign } from '@/lib/creative-workflow'
import { deleteProjectGraph } from '@/lib/delete-graph'
import { getProjectIfAllowed } from '@/lib/project-access'
import { getProjectMediaSupport } from '@/lib/project-media-support'
import {
  attachProjectAgencyFields,
  findProjectCategory,
  getProjectCategorySupport,
  updateProjectAgencyFields,
} from '@/lib/project-category-support'
import {
  getProjectCameraSupport,
  isProjectCameraEnumCompatibilityError,
  withProjectCameraDefaults,
} from '@/lib/project-camera-support'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { badRequest, forbidden, notFound, serviceUnavailable } from '@/modules/shared/errors'
import { canManageProjects } from '@/modules/projects/policy'
import {
  createProjectWithoutCameraFields,
  findClientForProject,
  findManagerInCompany,
  findProjectForDelete,
  findProjectForUpdate,
  findProjectsWithoutCameraFields,
  findRoomInCompany,
  getProjectCreateSelect,
  getProjectListSelect,
  getProjectUpdateSelect,
  projectPrisma as prisma,
} from '@/modules/projects/repository'
import type { ProjectSessionUser } from '@/modules/projects/types'
import {
  createProjectSchema,
  isValidProjectId,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@/modules/projects/validation'

export {
  attachProjectAgencyFields,
  findProjectCategory,
  getProjectCategorySupport,
  updateProjectAgencyFields,
} from '@/lib/project-category-support'

export {
  getProjectCameraSupport,
  isProjectCameraEnumCompatibilityError,
  withProjectCameraDefaults,
} from '@/lib/project-camera-support'

function requireCompany(user: ProjectSessionUser) {
  if (!user.companyId) throw badRequest('No company found for this account')
  return user.companyId
}

function assertManagerAccess(user: ProjectSessionUser) {
  if (!canManageProjects(user)) throw forbidden()
}

export async function listProjectsForUser(user: ProjectSessionUser) {
  if (!user.companyId) return []
  const companyId = user.companyId
  const support = await getProjectCameraSupport()

  let projects: Array<{ id: string } & Record<string, unknown>>
  if (!support.hasCameraColumns || !support.hasCameraTypeEnum) {
    projects = (await findProjectsWithoutCameraFields(companyId)) as Array<{ id: string } & Record<string, unknown>>
  } else {
    try {
      projects = (await prisma.project.findMany({
        where: { companyId },
        select: getProjectListSelect(true),
        orderBy: { createdAt: 'desc' },
      })) as unknown as Array<{ id: string } & Record<string, unknown>>
    } catch (error) {
      if (!isProjectCameraEnumCompatibilityError(error)) throw error
      projects = (await findProjectsWithoutCameraFields(companyId)) as Array<{ id: string } & Record<string, unknown>>
    }
  }

  const normalized = projects.map((project) => withProjectCameraDefaults(project)) as unknown as Array<{ id: string } & Record<string, unknown>>
  if (isAgencyCompanyType(normalizeCompanyType(user.companyType))) {
    return attachProjectAgencyFields(normalized, companyId)
  }
  return normalized
}

export async function getProjectForUser(user: ProjectSessionUser, id: string) {
  const companyId = requireCompany(user)
  if (!isValidProjectId(id)) throw notFound('Not found')

  const allowed = await getProjectIfAllowed(id, { id: user.id, role: user.role ?? '', companyId: user.companyId })
  if (!allowed) throw notFound('Not found')

  const support = await getProjectCameraSupport()
  const mediaSupport = await getProjectMediaSupport()
  const isAgency = isAgencyCompanyType(normalizeCompanyType(user.companyType))

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
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
      ...(support.hasCameraMediaTable
        ? { cameraMedia: { orderBy: { createdAt: 'desc' }, take: 12 } }
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

  if (!project) throw notFound('Not found')

  const [projectWithAgencyFields] = await attachProjectAgencyFields([withProjectCameraDefaults(project)], companyId)

  return {
    ...projectWithAgencyFields,
    cameraMedia: 'cameraMedia' in project ? project.cameraMedia : [],
    projectMedia: isAgency && 'projectMedia' in project ? project.projectMedia : [],
  }
}

export async function createProjectForUser(user: ProjectSessionUser, rawInput: unknown) {
  const companyId = requireCompany(user)
  assertManagerAccess(user)

  const input: CreateProjectInput = createProjectSchema.parse(rawInput)
  const companyType = normalizeCompanyType(user.companyType)
  const isAgency = isAgencyCompanyType(companyType)

  if (companyType === 'INDUSTRY' && !input.roomId?.trim()) {
    throw badRequest('Projects in industry workspaces must belong to a room.')
  }

  const [support, categorySupport] = await Promise.all([getProjectCameraSupport(), getProjectCategorySupport()])

  if (isAgency) {
    if (!categorySupport.hasCategoryTable || !categorySupport.hasProjectCategoryColumns) {
      throw serviceUnavailable('Project categories are not ready. Apply the latest database migration first.')
    }
    if (!input.categoryId?.trim()) throw badRequest('Agency campaigns must belong to a category.')

    const category = await findProjectCategory(companyId, input.categoryId)
    if (!category) throw notFound('Selected category was not found in this workspace.')
  }

  const selectedClient = input.clientId?.trim() ? await findClientForProject(input.clientId, companyId) : null
  if (input.clientId?.trim() && !selectedClient) {
    throw notFound('Selected client was not found in this workspace.')
  }

  if (input.roomId?.trim()) {
    const room = await findRoomInCompany(input.roomId, companyId)
    if (!room) throw notFound('Selected room was not found in this workspace.')
  }

  let project: Record<string, unknown>
  if (!support.hasCameraColumns || !support.hasCameraTypeEnum) {
    project = (await createProjectWithoutCameraFields({
      title: input.title,
      description: input.description ?? undefined,
      companyId,
      roomId: input.roomId || undefined,
      managerId: input.managerId ?? undefined,
      categoryId: isAgency ? input.categoryId : undefined,
      clientId: isAgency ? selectedClient?.id : undefined,
      clientName: isAgency ? selectedClient?.companyName ?? (input.clientName?.trim() || undefined) : undefined,
      hasProjectCategoryColumns: categorySupport.hasProjectCategoryColumns,
      hasProjectClientColumn: categorySupport.hasProjectClientColumn,
    })) as unknown as Record<string, unknown>
  } else {
    try {
      project = (await prisma.project.create({
        data: {
          title: input.title,
          description: input.description ?? undefined,
          companyId,
          roomId: input.roomId || null,
          managerId: input.managerId || null,
          hasCamera: Boolean(input.hasCamera),
          cameraType: input.cameraType === 'external' ? 'external' : 'device',
        },
        select: getProjectCreateSelect(true),
      })) as unknown as Record<string, unknown>

      if (isAgency && input.categoryId) {
        await updateProjectAgencyFields({
          projectId: project.id as string,
          companyId,
          categoryId: input.categoryId,
          clientId: selectedClient?.id ?? null,
          clientName: selectedClient?.companyName ?? (input.clientName?.trim() || null),
        })
      }
    } catch (error) {
      if (!isProjectCameraEnumCompatibilityError(error)) throw error
      project = (await createProjectWithoutCameraFields({
        title: input.title,
        description: input.description ?? undefined,
        companyId,
        roomId: input.roomId || undefined,
        managerId: input.managerId ?? undefined,
        categoryId: isAgency ? input.categoryId : undefined,
        clientId: isAgency ? selectedClient?.id : undefined,
        clientName: isAgency ? selectedClient?.companyName ?? (input.clientName?.trim() || undefined) : undefined,
        hasProjectCategoryColumns: categorySupport.hasProjectCategoryColumns,
        hasProjectClientColumn: categorySupport.hasProjectClientColumn,
      })) as unknown as Record<string, unknown>
    }
  }

  const normalizedProject = withProjectCameraDefaults(project) as unknown as { id: string } & Record<string, unknown>
  await ensureImportedBriefForCampaign({
    companyId,
    campaignId: normalizedProject.id,
    clientId: typeof normalizedProject.clientId === 'string' ? normalizedProject.clientId : selectedClient?.id ?? null,
    campaignTitle: typeof normalizedProject.title === 'string' ? normalizedProject.title : input.title,
    campaignDescription:
      typeof normalizedProject.description === 'string' ? normalizedProject.description : input.description ?? undefined,
    createdById: user.id ?? null,
  })

  if (isAgency) {
    const [withAgency] = await attachProjectAgencyFields([normalizedProject], companyId)
    emitCompanyRealtime(companyId, 'project_created', { project: withAgency })
    return withAgency
  }

  emitCompanyRealtime(companyId, 'project_created', { project: normalizedProject })
  return normalizedProject
}

export async function updateProjectForUser(user: ProjectSessionUser, id: string, rawInput: unknown) {
  const companyId = requireCompany(user)
  assertManagerAccess(user)
  if (!isValidProjectId(id)) throw notFound('Not found')

  const allowed = await getProjectIfAllowed(id, { id: user.id, role: user.role ?? '', companyId: user.companyId })
  if (!allowed) throw notFound('Not found')

  const body: UpdateProjectInput = updateProjectSchema.parse(rawInput)
  const support = await getProjectCameraSupport()
  const updatesCamera = typeof body.hasCamera === 'boolean' || body.cameraType !== undefined
  if (updatesCamera && (!support.hasCameraColumns || !support.hasCameraTypeEnum)) {
    throw serviceUnavailable('Project camera settings are not ready. Apply the latest database migration first.')
  }

  const title = body.title?.trim()
  const description = body.description === undefined ? undefined : body.description?.trim() || null
  const roomId = body.roomId === undefined ? undefined : body.roomId?.trim() || null
  const categoryId = body.categoryId === undefined ? undefined : body.categoryId?.trim() || null
  const clientId = body.clientId === undefined ? undefined : body.clientId?.trim() || null
  const clientName = body.clientName === undefined ? undefined : body.clientName?.trim() || null
  const managerId = body.managerId === undefined ? undefined : body.managerId?.trim() || null

  if (body.title !== undefined && !title) throw badRequest('Project name is required.')

  const existing = await findProjectForUpdate(id, companyId)
  if (!existing) throw notFound('Not found')

  if (roomId) {
    const room = await findRoomInCompany(roomId, companyId)
    if (!room) throw notFound('Selected room was not found in this workspace.')
  }
  if (managerId) {
    const manager = await findManagerInCompany(managerId, companyId)
    if (!manager) throw notFound('Selected manager was not found in this workspace.')
  }

  const selectedClient = clientId ? await findClientForProject(clientId, companyId) : null
  if (clientId && !selectedClient) throw notFound('Selected client was not found in this workspace.')

  const categorySupport = await getProjectCategorySupport()
  if (categoryId) {
    if (!isAgencyCompanyType(normalizeCompanyType(user.companyType))) {
      throw forbidden('Categories are only available for agency workspaces.')
    }
    if (!categorySupport.hasCategoryTable || !categorySupport.hasProjectCategoryColumns) {
      throw serviceUnavailable('Project categories are not ready. Apply the latest database migration first.')
    }
    const category = await findProjectCategory(companyId, categoryId)
    if (!category) throw notFound('Selected category was not found in this workspace.')
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
    select: getProjectUpdateSelect(support.hasCameraColumns),
  })

  if (categoryId !== undefined || clientId !== undefined || clientName !== undefined) {
    await updateProjectAgencyFields({
      projectId: id,
      companyId,
      categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
      clientId: clientId !== undefined ? clientId : existing.clientId,
      clientName: selectedClient?.companyName ?? (clientName !== undefined ? clientName : existing.clientName),
    })
  }

  const normalizedProject = withProjectCameraDefaults(project)
  const [withAgency] = await attachProjectAgencyFields([normalizedProject], companyId)
  emitCompanyRealtime(companyId, 'project_updated', { project: withAgency, projectId: id })
  return withAgency
}

export async function deleteProjectForUser(user: ProjectSessionUser, id: string) {
  const companyId = requireCompany(user)
  assertManagerAccess(user)
  if (!isValidProjectId(id)) throw notFound('Project not found.')

  const project = await findProjectForDelete(id, companyId)
  if (!project) throw notFound('Project not found.')

  await prisma.$transaction((tx) => deleteProjectGraph(tx, id))
  emitCompanyRealtime(companyId, 'project_deleted', { projectId: id })
  return { success: true, projectId: id }
}
