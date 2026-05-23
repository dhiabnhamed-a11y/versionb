import { spawn, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync, rmSync } from 'fs'
import path from 'path'

import { getFfmpegPath } from '@/lib/camera-ffmpeg'
import { getCameraStreamPaths } from '@/lib/camera-stream-paths'
import { prisma } from '@/lib/db'

type ManagedStream = {
  cameraId: string
  process: ChildProcess
  playlistPath: string
  outputDir: string
  restartAttempts: number
  stopping: boolean
  restartTimer?: NodeJS.Timeout
  readyTimer?: NodeJS.Timeout
  stderr: string[]
}

const globalForCameraStreams = globalThis as typeof globalThis & {
  cameraStreams?: Map<string, ManagedStream>
}

const streams = globalForCameraStreams.cameraStreams ?? new Map<string, ManagedStream>()
globalForCameraStreams.cameraStreams = streams

function clearStreamTimers(stream: ManagedStream) {
  if (stream.restartTimer) clearTimeout(stream.restartTimer)
  if (stream.readyTimer) clearInterval(stream.readyTimer)
}

function rememberStderr(stream: ManagedStream, chunk: Buffer) {
  const text = chunk.toString('utf8').trim()
  if (!text) return

  stream.stderr.push(text)
  if (stream.stderr.length > 12) {
    stream.stderr.splice(0, stream.stderr.length - 12)
  }
}

async function updateCameraStatus(
  cameraId: string,
  data: {
    status: string
    lastStartedAt?: Date
    lastSeenAt?: Date
    lastError?: string | null
  }
) {
  try {
    await prisma.projectCamera.update({
      where: { id: cameraId },
      data,
    })
  } catch (error) {
    console.error('[camera-stream] status update failed', cameraId, error)
  }
}

function buildHlsArgs(rtspUrl: string, paths: ReturnType<typeof getCameraStreamPaths>) {
  return [
    '-hide_banner',
    '-nostdin',
    '-rtsp_transport',
    'tcp',
    '-fflags',
    'nobuffer',
    '-flags',
    'low_delay',
    '-analyzeduration',
    '1000000',
    '-probesize',
    '1000000',
    '-i',
    rtspUrl,
    '-map',
    '0:v:0',
    '-an',
    '-c:v',
    'copy',
    '-f',
    'hls',
    '-hls_time',
    '1',
    '-hls_list_size',
    '4',
    '-hls_flags',
    'delete_segments+independent_segments+program_date_time',
    '-hls_allow_cache',
    '0',
    '-hls_segment_filename',
    paths.segmentPattern,
    paths.playlistPath,
  ]
}

function spawnStream(cameraId: string, rtspUrl: string, restartAttempts: number) {
  const paths = getCameraStreamPaths(cameraId)
  mkdirSync(paths.outputDir, { recursive: true })

  if (restartAttempts === 0) {
    rmSync(paths.outputDir, { recursive: true, force: true })
    mkdirSync(paths.outputDir, { recursive: true })
  }

  const child = spawn(getFfmpegPath(), buildHlsArgs(rtspUrl, paths), {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const stream: ManagedStream = {
    cameraId,
    process: child,
    playlistPath: paths.playlistPath,
    outputDir: paths.outputDir,
    restartAttempts,
    stopping: false,
    stderr: [],
  }

  streams.set(cameraId, stream)

  void updateCameraStatus(cameraId, {
    status: 'STARTING',
    lastStartedAt: new Date(),
    lastError: null,
  })

  child.stderr?.on('data', (chunk: Buffer) => rememberStderr(stream, chunk))

  stream.readyTimer = setInterval(() => {
    if (!existsSync(paths.playlistPath)) return

    if (stream.readyTimer) {
      clearInterval(stream.readyTimer)
      stream.readyTimer = undefined
    }

    void updateCameraStatus(cameraId, {
      status: 'ONLINE',
      lastSeenAt: new Date(),
      lastError: null,
    })
  }, 750)

  child.on('error', (error) => {
    stream.stderr.push(error.message)
  })

  child.on('exit', (code, signal) => {
    clearStreamTimers(stream)

    if (stream.stopping) {
      streams.delete(cameraId)
      void updateCameraStatus(cameraId, { status: 'OFFLINE' })
      return
    }

    const errorMessage =
      stream.stderr.at(-1) ||
      `FFmpeg exited unexpectedly with code ${code ?? 'unknown'}${signal ? ` and signal ${signal}` : ''}.`

    void updateCameraStatus(cameraId, {
      status: 'ERROR',
      lastError: errorMessage.slice(0, 500),
    })

    const nextAttempt = stream.restartAttempts + 1
    const backoffMs = Math.min(30_000, 2_000 * nextAttempt)

    stream.restartTimer = setTimeout(() => {
      spawnStream(cameraId, rtspUrl, nextAttempt)
    }, backoffMs)
  })

  return stream
}

export function startCameraStream(cameraId: string, rtspUrl: string) {
  const existing = streams.get(cameraId)
  if (existing && !existing.process.killed) {
    return {
      status: existsSync(existing.playlistPath) ? 'ONLINE' : 'STARTING',
      streamUrl: getCameraStreamPaths(cameraId).streamUrl,
    }
  }

  spawnStream(cameraId, rtspUrl, 0)

  return {
    status: 'STARTING',
    streamUrl: getCameraStreamPaths(cameraId).streamUrl,
  }
}

export async function stopCameraStream(cameraId: string) {
  const stream = streams.get(cameraId)
  if (!stream) {
    await updateCameraStatus(cameraId, { status: 'OFFLINE' })
    return
  }

  stream.stopping = true
  clearStreamTimers(stream)

  if (!stream.process.killed) {
    stream.process.kill('SIGTERM')
    setTimeout(() => {
      if (!stream.process.killed) {
        stream.process.kill('SIGKILL')
      }
    }, 3_000).unref()
  }

  streams.delete(cameraId)
  await updateCameraStatus(cameraId, { status: 'OFFLINE' })
}

export function getRuntimeStreamStatus(cameraId: string) {
  const stream = streams.get(cameraId)
  if (!stream) {
    return { running: false, streamUrl: getCameraStreamPaths(cameraId).streamUrl }
  }

  return {
    running: !stream.process.killed,
    streamUrl: getCameraStreamPaths(cameraId).streamUrl,
    playlistReady: existsSync(stream.playlistPath),
    lastError: stream.stderr.at(-1) ?? null,
  }
}

export async function captureCameraSnapshot(cameraId: string, rtspUrl: string) {
  const paths = getCameraStreamPaths(cameraId)
  mkdirSync(paths.outputDir, { recursive: true })

  const fileName = `snapshot-${Date.now()}.jpg`
  const outputPath = path.join(paths.outputDir, fileName)

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
        '-q:v',
        '2',
        '-y',
        outputPath,
      ],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )

    const stderr: string[] = []
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Snapshot timed out while waiting for the camera.'))
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
      if (code === 0 && existsSync(outputPath)) {
        resolve()
        return
      }

      reject(new Error(stderr.at(-1) || 'FFmpeg could not capture a snapshot.'))
    })
  })

  return `/streams/${cameraId}/${fileName}`
}
