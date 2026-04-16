import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDatabaseConfigHint, prisma } from '@/lib/db'
import {
  getProjectCameraSupport,
  isMissingCameraTypeError,
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
      if (!support.hasCameraColumns || !isMissingCameraTypeError(error)) {
        throw error
      }

      projects = await prisma.project.findMany({
        where: { companyId: user.companyId },
        select: getProjectListSelect(false),
        orderBy: { createdAt: 'desc' },
      })
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
      if (!support.hasCameraColumns || !isMissingCameraTypeError(error)) {
        throw error
      }

      project = await prisma.project.create({
        data: {
          title,
          description,
          companyId: user.companyId,
          managerId: managerId || null,
        },
        select: getProjectCreateSelect(false),
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
