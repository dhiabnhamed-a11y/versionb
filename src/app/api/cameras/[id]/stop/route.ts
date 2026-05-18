import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { canManageProjectCamera, getCameraForUser, toCameraDto } from '@/lib/camera-access'
import { stopCameraStream } from '@/lib/camera-stream-manager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser()
  if (!canManageProjectCamera(user)) {
    return NextResponse.json({ error: 'Only owners and managers can stop project camera streams.' }, { status: 403 })
  }

  const { id } = await params
  const result = await getCameraForUser(id, user)
  if (!result) return NextResponse.json({ error: 'Camera not found.' }, { status: 404 })

  await stopCameraStream(result.camera.id)

  return NextResponse.json({
    camera: toCameraDto({ ...result.camera, status: 'OFFLINE' }),
    status: 'OFFLINE',
  })
}
