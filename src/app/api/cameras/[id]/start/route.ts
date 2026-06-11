import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { decryptCameraSecret } from '@/lib/camera-crypto'
import { canManageProjectCamera, getCameraForUser, toCameraDto } from '@/lib/camera-access'
import { buildRtspUrl } from '@/lib/camera-rtsp-url'
import { startCameraStream } from '@/lib/camera-stream-manager'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
if (!canManageProjectCamera(user)) {
return NextResponse.json({ error: 'Only owners and managers can start project camera streams.' }, { status: 403 })
}

const { id } = await params
const result = await getCameraForUser(id, user)
if (!result) return NextResponse.json({ error: 'Camera not found.' }, { status: 404 })

let password: string
try {
password = decryptCameraSecret(result.camera.encryptedPassword)
} catch {
return NextResponse.json(
  { error: 'Stored camera password could not be decrypted. Re-save the camera with its password to refresh it.' },
  { status: 409 }
)
}

try {
const rtspUrl = buildRtspUrl({ ...result.camera, password })
const stream = startCameraStream(result.camera.id, rtspUrl)

return NextResponse.json({
  camera: toCameraDto(result.camera),
  ...stream,
})
} catch (error) {
return NextResponse.json(
  { error: error instanceof Error ? error.message : 'Failed to start the camera stream.' },
  { status: 500 }
)
}
}, { auth: 'required' });
