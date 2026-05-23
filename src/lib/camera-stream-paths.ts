import path from 'path'

export function getCameraStreamPaths(cameraId: string) {
  const outputDir = path.join(process.cwd(), '.camera-streams', cameraId)
  const playlistPath = path.join(outputDir, 'stream.m3u8')
  const segmentPattern = path.join(outputDir, 'segment-%05d.ts')

  return {
    outputDir,
    playlistPath,
    segmentPattern,
    streamUrl: `/streams/${cameraId}/stream.m3u8`,
  }
}
