import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export { prisma as projectPrisma }

export type RawProjectRow = {
  id: string
  title: string
  description: string | null
  roomId: string | null
  managerId: string | null
  createdAt: Date
  updatedAt: Date
  roomName: string | null
  managerUserId: string | null
  managerName: string | null
}

type RawTaskRow = {
  id: string
  projectId: string
  stage: string
  priority: string
}

export function getProjectListSelect(includeCameraFields: boolean) {
  return {
    id: true,
    title: true,
    description: true,
    roomId: true,
    managerId: true,
    createdAt: true,
    updatedAt: true,
    ...(includeCameraFields ? { hasCamera: true, cameraType: true } : {}),
    room: { select: { id: true, name: true } },
    manager: { select: { id: true, name: true } },
    tasks: { select: { id: true, stage: true, priority: true } },
  } as const
}

export function getProjectCreateSelect(includeCameraFields: boolean) {
  return {
    id: true,
    title: true,
    description: true,
    roomId: true,
    managerId: true,
    companyId: true,
    createdAt: true,
    updatedAt: true,
    ...(includeCameraFields ? { hasCamera: true, cameraType: true } : {}),
    room: { select: { id: true, name: true } },
  } as const
}

export function getProjectUpdateSelect(includeCameraFields: boolean) {
  return {
    id: true,
    title: true,
    description: true,
    roomId: true,
    managerId: true,
    createdAt: true,
    updatedAt: true,
    ...(includeCameraFields ? { hasCamera: true, cameraType: true } : {}),
    room: { select: { id: true, name: true } },
    manager: { select: { id: true, name: true } },
    tasks: { select: { id: true, stage: true, priority: true } },
  } as const
}

export async function findProjectsWithoutCameraFields(companyId: string) {
  const projectRows = await prisma.$queryRaw<RawProjectRow[]>`
    SELECT
      p."id",
      p."title",
      p."description",
      p."roomId",
      p."managerId",
      p."createdAt",
      p."updatedAt",
      r."name" AS "roomName",
      u."id" AS "managerUserId",
      u."name" AS "managerName"
    FROM "Project" p
    LEFT JOIN "Room" r ON r."id" = p."roomId"
    LEFT JOIN "User" u ON u."id" = p."managerId"
    WHERE p."companyId" = ${companyId}
    ORDER BY p."createdAt" DESC
  `

  const projectIds = projectRows.map((project) => project.id)
  const taskRows =
    projectIds.length > 0
      ? await prisma.$queryRaw<RawTaskRow[]>`
          SELECT
            t."id",
            t."projectId",
            t."stage",
            t."priority"
          FROM "Task" t
          WHERE t."projectId" IN (${Prisma.join(projectIds)})
        `
      : []

  const tasksByProjectId = new Map<string, Array<{ id: string; stage: string; priority: string }>>()
  for (const task of taskRows) {
    const tasks = tasksByProjectId.get(task.projectId) ?? []
    tasks.push({ id: task.id, stage: task.stage, priority: task.priority })
    tasksByProjectId.set(task.projectId, tasks)
  }

  return projectRows.map((project) => ({
    id: project.id,
    title: project.title,
    description: project.description ?? undefined,
    roomId: project.roomId ?? undefined,
    managerId: project.managerId ?? undefined,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    room: project.roomId && project.roomName ? { id: project.roomId, name: project.roomName } : null,
    manager:
      project.managerUserId && project.managerName ? { id: project.managerUserId, name: project.managerName } : undefined,
    tasks: tasksByProjectId.get(project.id) ?? [],
  }))
}

type ProjectCreateRow = {
  id: string
  title: string
  description: string | null
  roomId: string | null
  managerId: string | null
  companyId: string
  createdAt: Date
  updatedAt: Date
}

export async function createProjectWithoutCameraFields(input: {
  title: string
  description?: string | null
  companyId: string
  roomId?: string | null
  managerId?: string | null
  categoryId?: string | null
  clientId?: string | null
  clientName?: string | null
  hasProjectCategoryColumns?: boolean
  hasProjectClientColumn?: boolean
}) {
  const now = new Date()
  const id = randomUUID()

  if (input.hasProjectCategoryColumns && input.hasProjectClientColumn) {
    const rows = await prisma.$queryRaw<ProjectCreateRow[]>`
      INSERT INTO "Project" (
        "id","title","description","companyId","roomId","categoryId","clientId","clientName","managerId","createdAt","updatedAt"
      ) VALUES (
        ${id},${input.title},${input.description ?? null},${input.companyId},${input.roomId ?? null},
        ${input.categoryId ?? null},${input.clientId ?? null},${input.clientName ?? null},${input.managerId ?? null},${now},${now}
      )
      RETURNING "id","title","description","roomId","managerId","companyId","createdAt","updatedAt"
    `
    return rows[0]
  }

  if (input.hasProjectCategoryColumns) {
    const rows = await prisma.$queryRaw<ProjectCreateRow[]>`
      INSERT INTO "Project" (
        "id","title","description","companyId","roomId","categoryId","clientName","managerId","createdAt","updatedAt"
      ) VALUES (
        ${id},${input.title},${input.description ?? null},${input.companyId},${input.roomId ?? null},
        ${input.categoryId ?? null},${input.clientName ?? null},${input.managerId ?? null},${now},${now}
      )
      RETURNING "id","title","description","roomId","managerId","companyId","createdAt","updatedAt"
    `
    return rows[0]
  }

  const rows = await prisma.$queryRaw<ProjectCreateRow[]>`
    INSERT INTO "Project" (
      "id","title","description","companyId","roomId","managerId","createdAt","updatedAt"
    ) VALUES (
      ${id},${input.title},${input.description ?? null},${input.companyId},${input.roomId ?? null},${input.managerId ?? null},${now},${now}
    )
    RETURNING "id","title","description","roomId","managerId","companyId","createdAt","updatedAt"
  `
  return rows[0]
}

export function findRoomInCompany(roomId: string, companyId: string) {
  return prisma.room.findFirst({ where: { id: roomId, companyId }, select: { id: true } })
}

export function findManagerInCompany(managerId: string, companyId: string) {
  return prisma.user.findFirst({ where: { id: managerId, companyId }, select: { id: true } })
}

export function findClientForProject(clientId: string, companyId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, companyId },
    select: { id: true, companyName: true },
  })
}

export function findProjectForUpdate(id: string, companyId: string) {
  return prisma.project.findFirst({
    where: { id, companyId },
    select: { id: true, categoryId: true, clientId: true, clientName: true },
  })
}

export function findProjectForDelete(id: string, companyId: string) {
  return prisma.project.findFirst({ where: { id, companyId }, select: { id: true } })
}
