import { prisma } from '@/lib/db'
import { getProjectIfAllowed, type SessionUser } from '@/lib/project-access'
import { getRuntimeStreamStatus } from '@/lib/camera-stream-manager'

export type CameraSessionUser = SessionUser & {
  role: string
}

export function canManageProjectCamera(user: CameraSessionUser) {
  return user.role === 'OWNER' || user.role === 'MANAGER'
}

export function toCameraDto(camera: {
  id: string
  projectId: string
  name: string
  ipAddress: string
  port: number
  username: string
  rtspPath: string
  status: string
  lastStartedAt: Date | null
  lastSeenAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}) {
  const runtime = getRuntimeStreamStatus(camera.id)

  return {
    id: camera.id,
    projectId: camera.projectId,
    name: camera.name,
    ipAddress: camera.ipAddress,
    port: camera.port,
    username: camera.username,
    rtspPath: camera.rtspPath,
    status: runtime.playlistReady ? 'ONLINE' : camera.status,
    streamUrl: runtime.streamUrl,
    runtime,
    lastStartedAt: camera.lastStartedAt,
    lastSeenAt: camera.lastSeenAt,
    lastError: camera.lastError,
    createdAt: camera.createdAt,
    updatedAt: camera.updatedAt,
  }
}

export async function getProjectCameraForUser(projectId: string, user: CameraSessionUser) {
  const project = await getProjectIfAllowed(projectId, user)
  if (!project) return null

  const camera = await prisma.projectCamera.findUnique({
    where: { projectId },
  })

  if (!camera) return null
  return { project, camera }
}

export async function getCameraForUser(cameraId: string, user: CameraSessionUser) {
  const camera = await prisma.projectCamera.findUnique({
    where: { id: cameraId },
  })

  if (!camera) return null

  const project = await getProjectIfAllowed(camera.projectId, user)
  if (!project) return null

  return { project, camera }
}
