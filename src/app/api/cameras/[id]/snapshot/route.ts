import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { decryptCameraSecret } from '@/lib/camera-crypto'
import { getCameraForUser } from '@/lib/camera-access'
import { buildRtspUrl } from '@/lib/camera-rtsp-url'
import { captureCameraSnapshot } from '@/lib/camera-stream-manager'
import { prisma } from '@/lib/db'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
const { id } = await params
const result = await getCameraForUser(id, user)
if (!result) return NextResponse.json({ error: 'Camera not found.' }, { status: 404 })

try {
const password = decryptCameraSecret(result.camera.encryptedPassword)
const rtspUrl = buildRtspUrl({ ...result.camera, password })
const fileUrl = await captureCameraSnapshot(result.camera.id, rtspUrl)

const media = await prisma.projectCameraMedia.create({
  data: {
    projectId: result.camera.projectId,
    fileUrl,
    type: 'image',
  },
})

await prisma.projectCamera.update({
  where: { id: result.camera.id },
  data: {
    lastSeenAt: new Date(),
    lastError: null,
  },
})

return NextResponse.json(media, { status: 201 })
} catch (error) {
return NextResponse.json(
  { error: error instanceof Error ? error.message : 'Snapshot capture failed.' },
  { status: 500 }
)
}
}, { auth: 'required' });
