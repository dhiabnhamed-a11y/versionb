import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDatabaseConfigHint, prisma } from '@/lib/db'
import { getProjectCameraSupport, withProjectCameraDefaults } from '@/lib/project-camera-support'

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
    const projects = await prisma.project.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        title: true,
        description: true,
        managerId: true,
        createdAt: true,
        updatedAt: true,
        ...(support.hasCameraColumns ? { hasCamera: true, cameraType: true } : {}),
        manager: { select: { id: true, name: true } },
        tasks: { select: { id: true, stage: true, priority: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
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

    const project = await prisma.project.create({
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
      select: {
        id: true,
        title: true,
        description: true,
        managerId: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
        ...(support.hasCameraColumns ? { hasCamera: true, cameraType: true } : {}),
      },
    })
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
