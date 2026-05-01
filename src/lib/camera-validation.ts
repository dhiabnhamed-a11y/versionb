export type CameraConfigInput = {
  projectId: string
  name: string
  ipAddress: string
  port: number
  username: string
  password: string
  rtspPath: string
}

type CameraBody = {
  projectId?: string
  name?: string
  ipAddress?: string
  port?: number | string
  username?: string
  password?: string
  rtspPath?: string
}

export function normalizeCameraInput(body: CameraBody): { value: CameraConfigInput } | { error: string } {
  const projectId = body.projectId?.trim()
  const name = body.name?.trim()
  const ipAddress = body.ipAddress?.trim()
  const username = body.username?.trim()
  const password = body.password
  const port = Number(body.port ?? 554)
  const rtspPath = body.rtspPath?.trim() || '/stream'

  if (!projectId || !name || !ipAddress || !username || !password) {
    return { error: 'projectId, camera name, IP address, username, and password are required.' }
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: 'Port must be a number between 1 and 65535.' }
  }

  if (!/^\/?[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/.test(rtspPath)) {
    return { error: 'RTSP path contains unsupported characters.' }
  }

  return {
    value: {
      projectId,
      name,
      ipAddress,
      port,
      username,
      password,
      rtspPath: rtspPath.startsWith('/') ? rtspPath : `/${rtspPath}`,
    },
  }
}
