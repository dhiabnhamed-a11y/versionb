import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { decryptCameraSecret } from '@/lib/camera-crypto'
import { canManageProjectCamera, getCameraForUser, toCameraDto } from '@/lib/camera-access'
import { buildRtspUrl, startCameraStream } from '@/lib/camera-stream-manager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string; companyId?: string | null }
  if (!canManageProjectCamera(user)) {
    return NextResponse.json({ error: 'Only owners and managers can start project camera streams.' }, { status: 403 })
  }

  const { id } = await params
  const result = await getCameraForUser(id, user)
  if (!result) return NextResponse.json({ error: 'Camera not found.' }, { status: 404 })

  const password = decryptCameraSecret(result.camera.encryptedPassword)
  const rtspUrl = buildRtspUrl({ ...result.camera, password })
  const stream = startCameraStream(result.camera.id, rtspUrl)

  return NextResponse.json({
    camera: toCameraDto(result.camera),
    ...stream,
  })
}
