import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { encryptCameraSecret } from '@/lib/camera-crypto'
import { canManageProjectCamera, getProjectCameraForUser, toCameraDto } from '@/lib/camera-access'
import { normalizeCameraInput } from '@/lib/camera-validation'
import { prisma } from '@/lib/db'
import { getProjectIfAllowed } from '@/lib/project-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string; companyId?: string | null }
  const projectId = req.nextUrl.searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId query parameter is required.' }, { status: 400 })
  }

  const result = await getProjectCameraForUser(projectId, user)
  if (!result) return NextResponse.json(null)

  return NextResponse.json(toCameraDto(result.camera))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string; companyId?: string | null }
  if (!canManageProjectCamera(user)) {
    return NextResponse.json({ error: 'Only owners and managers can configure project cameras.' }, { status: 403 })
  }

  const parsed = normalizeCameraInput(await req.json().catch(() => ({})))
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const input = parsed.value
  const project = await getProjectIfAllowed(input.projectId, user)
  if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

  const encryptedPassword = encryptCameraSecret(input.password)

  const camera = await prisma.projectCamera.upsert({
    where: { projectId: input.projectId },
    create: {
      projectId: input.projectId,
      name: input.name,
      ipAddress: input.ipAddress,
      port: input.port,
      username: input.username,
      encryptedPassword,
      rtspPath: input.rtspPath,
    },
    update: {
      name: input.name,
      ipAddress: input.ipAddress,
      port: input.port,
      username: input.username,
      encryptedPassword,
      rtspPath: input.rtspPath,
      status: 'OFFLINE',
      lastError: null,
    },
  })

  await prisma.project.update({
    where: { id: input.projectId },
    data: {
      hasCamera: true,
      cameraType: 'external',
    },
  })

  return NextResponse.json(toCameraDto(camera), { status: 201 })
}
