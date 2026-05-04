import { NextRequest, NextResponse } from 'next/server'

import {
  AGENCY_MEDIA_LIMITS,
  getCloudinaryDeliveryUrls,
  validateAgencyMediaFile,
  uploadAgencyMediaBuffer,
} from '@/lib/cloudinary'
import { normalizeCompanyType } from '@/lib/company-types'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getProjectIfAllowed } from '@/lib/project-access'
import { getProjectMediaSupport } from '@/lib/project-media-support'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { NO_STORE_HEADERS } from '@/lib/http'

type SessionUser = {
  id: string
  role: string
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

async function getAllowedAgencyProject(projectId: string, user: SessionUser) {
  if (!user.companyId) return { response: NextResponse.json({ error: 'No company found for this account' }, { status: 400 }) }
  if (normalizeCompanyType(user.companyType) !== 'DIGITAL_AGENCY') {
    return { response: NextResponse.json({ error: 'Media uploads are only available for digital agency workspaces.' }, { status: 403 }) }
  }

  const project = await getProjectIfAllowed(projectId, user)
  if (!project) return { response: NextResponse.json({ error: 'Project not found.' }, { status: 404 }) }

  return { project }
}

export async function GET(_req: NextRequest, context: RouteContext<'/api/projects/[id]/media'>) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  const { id } = await context.params
  const allowed = await getAllowedAgencyProject(id, user)
  if ('response' in allowed) return allowed.response

  const support = await getProjectMediaSupport()
  if (!support.hasProjectMediaTable) {
    return NextResponse.json({ error: 'Cloudinary media database tables are not ready. Apply the latest migration first.' }, { status: 503 })
  }

  const media = await prisma.projectMedia.findMany({
    where: { projectId: id },
    select: mediaSelect,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(media, { headers: NO_STORE_HEADERS })
}

export async function POST(req: NextRequest, context: RouteContext<'/api/projects/[id]/media'>) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
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

  const file = formData.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'A file is required.' }, { status: 400 })

  const inputFile = file as File & { name?: string }
  const fileName = sanitizeFileName(inputFile.name?.trim() || `media-${Date.now()}`)
  const mimeType = file.type || 'application/octet-stream'
  const validation = validateAgencyMediaFile({ mimeType, size: file.size })
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
  if (file.size > AGENCY_MEDIA_LIMITS.standardUpload) {
    return NextResponse.json({ error: 'Use chunk upload for files larger than 25MB.' }, { status: 413 })
  }

  try {
    const result = await uploadAgencyMediaBuffer({
      buffer: Buffer.from(await file.arrayBuffer()),
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
        size: result.bytes ?? file.size,
        duration: typeof result.duration === 'number' ? result.duration : null,
        width: typeof result.width === 'number' ? result.width : null,
        height: typeof result.height === 'number' ? result.height : null,
        format: result.format ?? null,
      },
      select: mediaSelect,
    })

    emitCompanyRealtime(user.companyId!, 'project_media_created', { projectId: id, media })
    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    console.error('[cloudinary-media-upload]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cloudinary upload failed.' },
      { status: 500 }
    )
  }
}
