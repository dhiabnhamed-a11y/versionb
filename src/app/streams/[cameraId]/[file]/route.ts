import { readFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { getCameraForUser } from '@/lib/camera-access'
import { getCameraStreamPaths } from '@/lib/camera-stream-manager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const contentTypes: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.jpg': 'image/jpeg',
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cameraId: string; file: string }> }) {
  const session = await auth()
  if (!session?.user) return new NextResponse(null, { status: 401 })

  const user = session.user as { id: string; role: string; companyId?: string | null }
  const { cameraId, file } = await params

  if (file !== path.basename(file)) {
    return new NextResponse(null, { status: 400 })
  }

  const result = await getCameraForUser(cameraId, user)
  if (!result) return new NextResponse(null, { status: 404 })

  const paths = getCameraStreamPaths(cameraId)
  const requestedPath = path.join(paths.outputDir, file)

  try {
    const body = await readFile(requestedPath)
    const extension = path.extname(file).toLowerCase()

    return new NextResponse(body, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': contentTypes[extension] || 'application/octet-stream',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
