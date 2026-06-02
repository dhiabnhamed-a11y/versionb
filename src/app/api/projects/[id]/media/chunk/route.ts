import { requireSessionUser } from '@/modules/shared/session'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, rm, stat } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { NextRequest, NextResponse } from 'next/server'

import {
  AGENCY_MEDIA_LIMITS,
  getCloudinaryDeliveryUrls,
  uploadAgencyMediaFile,
  validateAgencyMediaFile,
} from '@/lib/cloudinary'
import { isAgencyCompanyType, normalizeCompanyType } from '@/lib/company-types'
import { prisma } from '@/lib/db'
import { getProjectIfAllowed } from '@/lib/project-access'
import { getProjectMediaSupport } from '@/lib/project-media-support'
import { emitCompanyRealtime } from '@/lib/realtime-server'

export const runtime = 'nodejs'

type SessionUser = {
  id: string
  role?: string | null
  companyId?: string | null
  companyType?: string | null
}

const mediaSelect = {
  id: true,
  projectId: true,
  url: true,
  playbackUrl: true,
  thumbnailUrl: true,
  cloudinaryPublicId: true,
  type: true,
  mimeType: true,
  originalFilename: true,
  size: true,
  duration: true,
  width: true,
  height: true,
  format: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true } },
} as const

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._ -]/g, '-').trim() || `media-${Date.now()}`
}

function safeToken(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^[a-zA-Z0-9_-]{12,80}$/.test(trimmed) ? trimmed : null
}

async function getAllowedAgencyProject(projectId: string, user: SessionUser) {
  if (!user.companyId) return { response: NextResponse.json({ error: 'No company found for this account' }, { status: 400 }) }
  if (!isAgencyCompanyType(normalizeCompanyType(user.companyType))) {
    return { response: NextResponse.json({ error: 'Media uploads are only available for agency workspaces.' }, { status: 403 }) }
  }

  const project = await getProjectIfAllowed(projectId, user)
  if (!project) return { response: NextResponse.json({ error: 'Project not found.' }, { status: 404 }) }

  return { project }
}

async function writeFileFromBlob(path: string, blob: Blob) {
  const bytes = Buffer.from(await blob.arrayBuffer())
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(path)
    stream.on('error', reject)
    stream.on('finish', resolve)
    stream.end(bytes)
  })
}

async function hasAllChunks(dir: string, totalChunks: number) {
  for (let index = 0; index < totalChunks; index += 1) {
    try {
      await stat(join(dir, `${index}.part`))
    } catch {
      return false
    }
  }
  return true
}

async function assembleChunks(dir: string, totalChunks: number, target: string) {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(target)
    output.on('error', reject)
    output.on('finish', resolve)

    async function append(index: number) {
      if (index >= totalChunks) {
        output.end()
        return
      }

      const chunk = createReadStream(join(dir, `${index}.part`))
      chunk.on('error', reject)
      chunk.on('end', () => void append(index + 1))
      chunk.pipe(output, { end: false })
    }

    void append(0)
  })
}

export async function POST(req: NextRequest, context: RouteContext<'/api/projects/[id]/media/chunk'>) {
  const user = await requireSessionUser()
  const { id } = await context.params
  const allowed = await getAllowedAgencyProject(id, user)
  if ('response' in allowed) return allowed.response

  const support = await getProjectMediaSupport()
  if (!support.hasProjectMediaTable) {
    return NextResponse.json({ error: 'Cloudinary media database tables are not ready. Apply the latest migration first.' }, { status: 503 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 })
  }

  const file = formData.get('chunk')
  const uploadId = safeToken(formData.get('uploadId'))
  const fileNameRaw = formData.get('fileName')
  const mimeTypeRaw = formData.get('mimeType')
  const chunkIndex = Number(formData.get('chunkIndex'))
  const totalChunks = Number(formData.get('totalChunks'))
  const totalSize = Number(formData.get('totalSize'))

  if (!(file instanceof Blob) || !uploadId || typeof fileNameRaw !== 'string' || typeof mimeTypeRaw !== 'string') {
    return NextResponse.json({ error: 'chunk, uploadId, fileName, and mimeType are required.' }, { status: 400 })
  }
  if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || chunkIndex < 0 || totalChunks < 2 || chunkIndex >= totalChunks) {
    return NextResponse.json({ error: 'Invalid chunk metadata.' }, { status: 400 })
  }
  if (file.size > AGENCY_MEDIA_LIMITS.chunk) {
    return NextResponse.json({ error: 'Each chunk must be 8MB or smaller.' }, { status: 413 })
  }

  const fileName = sanitizeFileName(fileNameRaw)
  const mimeType = mimeTypeRaw.toLowerCase()
  const validation = validateAgencyMediaFile({ mimeType, size: totalSize })
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })

  const root = join(tmpdir(), 'tasked-cloudinary-chunks', user.companyId!, id, uploadId)
  const finalPath = join(root, 'assembled-upload')

  try {
    await mkdir(root, { recursive: true })
    await writeFileFromBlob(join(root, `${chunkIndex}.part`), file)

    if (!(await hasAllChunks(root, totalChunks))) {
      return NextResponse.json({ complete: false })
    }

    await assembleChunks(root, totalChunks, finalPath)
    const result = await uploadAgencyMediaFile({
      filePath: finalPath,
      companyId: user.companyId!,
      projectId: id,
      type: validation.type,
      fileName,
    })
    const urls = getCloudinaryDeliveryUrls(result, validation.type)

    const media = await prisma.projectMedia.create({
      data: {
        projectId: id,
        uploadedById: user.id,
        url: urls.url,
        playbackUrl: urls.playbackUrl,
        thumbnailUrl: urls.thumbnailUrl,
        cloudinaryPublicId: result.public_id,
        type: validation.type,
        mimeType,
        originalFilename: fileName,
        size: result.bytes ?? totalSize,
        duration: typeof result.duration === 'number' ? result.duration : null,
        width: typeof result.width === 'number' ? result.width : null,
        height: typeof result.height === 'number' ? result.height : null,
        format: result.format ?? null,
      },
      select: mediaSelect,
    })

    await rm(root, { recursive: true, force: true })
    emitCompanyRealtime(user.companyId!, 'project_media_created', { projectId: id, media })
    return NextResponse.json({ complete: true, media }, { status: 201 })
  } catch (error) {
    console.error('[cloudinary-media-chunk-upload]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cloudinary chunk upload failed.' },
      { status: 500 }
    )
  }
}
