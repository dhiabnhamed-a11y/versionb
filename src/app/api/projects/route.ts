import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { getDatabaseConfigHint, prisma } from '@/lib/db'
import {
  getProjectCameraSupport,
  isProjectCameraEnumCompatibilityError,
  withProjectCameraDefaults,
} from '@/lib/project-camera-support'

function getProjectListSelect(includeCameraFields: boolean) {
  return {
    id: true,
    title: true,
    description: true,
    managerId: true,
    createdAt: true,
    updatedAt: true,
    ...(includeCameraFields ? { hasCamera: true, cameraType: true } : {}),
    manager: { select: { id: true, name: true } },
    tasks: { select: { id: true, stage: true, priority: true } },
  } as const
}

function getProjectCreateSelect(includeCameraFields: boolean) {
  return {
    id: true,
    title: true,
    description: true,
    managerId: true,
    companyId: true,
    createdAt: true,
    updatedAt: true,
    ...(includeCameraFields ? { hasCamera: true, cameraType: true } : {}),
  } as const
}

type RawProjectRow = {
  id: string
  title: string
  description: string | null
  managerId: string | null
  createdAt: Date
  updatedAt: Date
  managerUserId: string | null
  managerName: string | null
}

type RawTaskRow = {
  id: string
  projectId: string
  stage: string
  priority: string
}

async function findProjectsWithoutCameraFields(companyId: string) {
  const projectRows = await prisma.$queryRaw<RawProjectRow[]>`
    SELECT
      p."id",
      p."title",
      p."description",
      p."managerId",
      p."createdAt",
      p."updatedAt",
      u."id" AS "managerUserId",
      u."name" AS "managerName"
    FROM "Project" p
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

  return projectRows.map((project) =>
    withProjectCameraDefaults({
      id: project.id,
      title: project.title,
      description: project.description ?? undefined,
      managerId: project.managerId ?? undefined,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      manager: project.managerUserId && project.managerName ? { id: project.managerUserId, name: project.managerName } : undefined,
      tasks: tasksByProjectId.get(project.id) ?? [],
    })
  )
}

async function createProjectWithoutCameraFields(input: {
  title: string
  description?: string
  companyId: string
  managerId?: string
}) {
  const now = new Date()
  const id = randomUUID()
  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      title: string
      description: string | null
      managerId: string | null
      companyId: string
      createdAt: Date
      updatedAt: Date
    }>
  >`
    INSERT INTO "Project" (
      "id",
      "title",
      "description",
      "companyId",
      "managerId",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${input.title},
      ${input.description ?? null},
      ${input.companyId},
      ${input.managerId ?? null},
      ${now},
      ${now}
    )
    RETURNING
      "id",
      "title",
      "description",
      "managerId",
      "companyId",
      "createdAt",
      "updatedAt"
  `

  return withProjectCameraDefaults({
    ...rows[0],
    description: rows[0]?.description ?? undefined,
    managerId: rows[0]?.managerId ?? undefined,
  })
}

// GET all projects for company
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { companyId?: string | null }
  if (!user.companyId) {
    return NextResponse.json([])
  }

  try {
    const support = await getProjectCameraSupport()
    let projects
    try {
      projects = await prisma.project.findMany({
        where: { companyId: user.companyId },
        select: getProjectListSelect(support.hasCameraColumns),
        orderBy: { createdAt: 'desc' },
      })
    } catch (error) {
      if (!support.hasCameraColumns || !isProjectCameraEnumCompatibilityError(error)) {
        throw error
      }

      projects = await findProjectsWithoutCameraFields(user.companyId)
    }

    return NextResponse.json(projects.map(withProjectCameraDefaults))
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      {
        error: 'Unable to load projects',
        detail: err instanceof Error ? err.message : 'Unknown database error',
        hint: getDatabaseConfigHint(),
      },
      { status: 500 }
    )
  }
}

// POST create project
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { role?: string; companyId?: string | null }
  if (!user.companyId) {
    return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  }
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const support = await getProjectCameraSupport()
    const body = await req.json()
    const { title, description, managerId, hasCamera, cameraType } = body as {
      title: string
      description?: string
      managerId?: string
      hasCamera?: boolean
      cameraType?: 'device' | 'external'
    }

    let project
    try {
      project = await prisma.project.create({
        data: {
          title,
          description,
          companyId: user.companyId,
          managerId: managerId || null,
          ...(support.hasCameraColumns
            ? {
                hasCamera: Boolean(hasCamera),
                cameraType: cameraType === 'external' ? 'external' : 'device',
              }
            : {}),
        },
        select: getProjectCreateSelect(support.hasCameraColumns),
      })
    } catch (error) {
      if (!support.hasCameraColumns || !isProjectCameraEnumCompatibilityError(error)) {
        throw error
      }

      project = await createProjectWithoutCameraFields({
        title,
        description,
        companyId: user.companyId,
        managerId,
      })
    }

    return NextResponse.json(withProjectCameraDefaults(project), { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      {
        error: 'Unable to create project',
        detail: err instanceof Error ? err.message : 'Unknown database error',
        hint: getDatabaseConfigHint(),
      },
      { status: 500 }
    )
  }
}
