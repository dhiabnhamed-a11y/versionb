export function buildRtspUrl(input: {
  ipAddress: string
  port: number
  username: string
  password: string
  rtspPath?: string | null
}) {
  const normalizedPath = input.rtspPath?.startsWith('/') ? input.rtspPath : `/${input.rtspPath || 'stream'}`
  const user = encodeURIComponent(input.username)
  const password = encodeURIComponent(input.password)

  return `rtsp://${user}:${password}@${input.ipAddress}:${input.port}${normalizedPath}`
}
