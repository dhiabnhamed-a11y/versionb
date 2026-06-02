import { requireSessionUser } from '@/modules/shared/session'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { getSupabaseAdmin, TASK_DELIVERABLE_BUCKET } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Only admins and managers can attach files.' }, { status: 403 })
  }

  const { id } = await params
  const companyId = user.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const task = await prisma.task.findFirst({
    where: { id, project: { companyId } },
    select: {
      id: true,
      projectId: true,
      project: { select: { companyId: true } },
    },
  })

  if (!task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length === 0) {
    return NextResponse.json({ error: 'Empty files cannot be uploaded.' }, { status: 400 })
  }

  const inputFile = file as File & { name?: string }
  const rawName = inputFile.name?.trim() || `attachment-${Date.now()}`
  const safeName = sanitizeFileName(rawName)
  const extension = safeName.includes('.') ? safeName.slice(safeName.lastIndexOf('.')) : ''
  const storagePath = `attachments/${companyId}/${id}/${Date.now()}-${randomUUID().slice(0, 8)}${extension}`
  const contentType = file.type || 'application/octet-stream'

  const maxSize = 50 * 1024 * 1024
  if (buffer.length > maxSize) {
    return NextResponse.json({ error: 'File must be under 50MB.' }, { status: 413 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { error: uploadError } = await supabase.storage.from(TASK_DELIVERABLE_BUCKET).upload(storagePath, buffer, {
      contentType,
      upsert: false,
    })

    if (uploadError) {
      return NextResponse.json({
        error: 'Storage upload failed.',
        detail: uploadError.message,
      }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(TASK_DELIVERABLE_BUCKET).getPublicUrl(storagePath)

    const attachment = await prisma.taskSubmission.create({
      data: {
        taskId: task.id,
        userId: user.id,
        fileUrl: publicUrl,
        fileName: safeName,
        fileType: contentType,
        fileSize: buffer.length,
      },
      select: {
        id: true,
        fileUrl: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    })

    await prisma.activity.create({
      data: {
        taskId: task.id,
        userId: user.id,
        action: `Attached file: ${safeName}`,
      },
    })

    emitCompanyRealtime(task.project.companyId, 'task_submission_created', {
      projectId: task.projectId,
      taskId: task.id,
      submission: attachment,
    })

    return NextResponse.json(attachment, { status: 201, headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[task-attachment-upload]', { taskId: task.id, fileName: safeName, error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload attachment.' },
      { status: 500 }
    )
  }
}
