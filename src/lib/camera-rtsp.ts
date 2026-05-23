import { spawn } from 'child_process'

import { getFfmpegPath } from '@/lib/camera-ffmpeg'

export async function testRtspConnection(rtspUrl: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      getFfmpegPath(),
      [
        '-hide_banner',
        '-nostdin',
        '-rtsp_transport',
        'tcp',
        '-i',
        rtspUrl,
        '-frames:v',
        '1',
        '-f',
        'null',
        '-',
      ],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )

    const stderr: string[] = []
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Camera test timed out. Confirm the IP, port, credentials, and network access.'))
    }, 20_000)

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim()
      if (text) stderr.push(text)
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })

    child.on('exit', (code) => {
      clearTimeout(timeout)
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.at(-1) || 'Unable to connect to the camera stream.'))
    })
  })
}
