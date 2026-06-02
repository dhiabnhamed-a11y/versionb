import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { getProjectIfAllowed } from '@/lib/project-access'
import { getProjectCameraSupport } from '@/lib/project-camera-support'
import { getSupabaseAdmin, PROJECT_CAMERA_BUCKET } from '@/lib/supabase-admin'
import { API_RATE_LIMITS } from '@/lib/api-defaults'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rate = await enforceDistributedRateLimit(req, API_RATE_LIMITS.upload)
  if (!rate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const user = await requireSessionUser()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const projectId = form.get('projectId')
  const type = form.get('type')
  const file = form.get('file')

  if (typeof projectId !== 'string' || typeof type !== 'string' || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'projectId, type (image|video), and file are required' }, { status: 400 })
  }

  if (type !== 'image' && type !== 'video') {
    return NextResponse.json({ error: 'type must be image or video' }, { status: 400 })
  }

  const project = await getProjectIfAllowed(projectId, user)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!project.hasCamera) {
    return NextResponse.json({ error: 'Camera is not enabled for this project' }, { status: 403 })
  }

  const support = await getProjectCameraSupport()
  if (!support.hasCameraMediaTable) {
    return NextResponse.json(
      { error: 'Project camera storage is not ready yet. Apply the latest database migration first.' },
      { status: 503 }
    )
  }

  const maxBytes = type === 'image' ? 12 * 1024 * 1024 : 80 * 1024 * 1024
  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }
  if (buffer.length > maxBytes) {
    return NextResponse.json({ error: 'File exceeds allowed size' }, { status: 413 })
  }

  const ext = type === 'image' ? 'jpg' : 'webm'
  const mime =
    file.type ||
    (type === 'image' ? 'image/jpeg' : 'video/webm')
  const path = `${projectId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`

  try {
    const supabase = getSupabaseAdmin()
    const { error: upErr } = await supabase.storage.from(PROJECT_CAMERA_BUCKET).upload(path, buffer, {
      contentType: mime,
      upsert: false,
    })

    if (upErr) {
      console.error('Supabase upload:', upErr)
      return NextResponse.json(
        {
          error: 'Storage upload failed',
          detail: upErr.message,
          hint: `Create a public bucket named "${PROJECT_CAMERA_BUCKET}" in Supabase Storage (or set SUPABASE_PROJECT_CAMERA_BUCKET).`,
        },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(PROJECT_CAMERA_BUCKET).getPublicUrl(path)

    const row = await prisma.projectCameraMedia.create({
      data: {
        projectId,
        fileUrl: publicUrl,
        type,
      },
    })

    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error(e)
    const message = e instanceof Error ? e.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
