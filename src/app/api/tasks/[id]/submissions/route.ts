import { requireSessionUser } from '@/modules/shared/session'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import {
  AGENCY_MEDIA_LIMITS,
  getCloudinaryDeliveryUrls,
  uploadAgencyMediaBuffer,
  validateAgencyMediaFile,
} from '@/lib/cloudinary'
import { isAgencyCompanyType, normalizeCompanyType } from '@/lib/company-types'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { getProjectMediaSupport } from '@/lib/project-media-support'
import { getSupabaseAdmin, TASK_DELIVERABLE_BUCKET } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

type SessionUser = {
  id: string
  role?: string | null
  companyId?: string | null
  companyType?: string | null
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

async function getTaskForSubmission(taskId: string, user: SessionUser) {
  if (!user.companyId) return null

  return prisma.task.findFirst({
    where: {
      id: taskId,
      project: {
        companyId: user.companyId,
      },
    },
    select: {
      id: true,
      assigneeId: true,
      projectId: true,
      deliverableId: true,
      title: true,
      project: { select: { companyId: true } },
    },
  })
}

export async function GET(_req: NextRequest, context: RouteContext<'/api/tasks/[id]/submissions'>) {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const task = await getTaskForSubmission(id, user)

  if (!task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }

  if (user.role === 'EMPLOYEE' && task.assigneeId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const submissions = await prisma.taskSubmission.findMany({
    where: {
      taskId: task.id,
    },
    select: {
      id: true,
      fileUrl: true,
      fileName: true,
      fileType: true,
      mediaType: true,
      fileSize: true,
      duration: true,
      thumbnailUrl: true,
      playbackUrl: true,
      cloudinaryPublicId: true,
      note: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  return NextResponse.json(submissions, { headers: NO_STORE_HEADERS })
}

export async function POST(req: NextRequest, context: RouteContext<'/api/tasks/[id]/submissions'>) {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const task = await getTaskForSubmission(id, user)

  if (!task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }

  if (user.role === 'EMPLOYEE' && task.assigneeId !== user.id) {
    return NextResponse.json({ error: 'Only the assigned employee can upload work for this task.' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 })
  }

  const file = formData.get('file')
  const note = formData.get('note')

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length === 0) {
    return NextResponse.json({ error: 'Empty files cannot be uploaded.' }, { status: 400 })
  }

  const inputFile = file as File & { name?: string }
  const rawName = inputFile.name?.trim() || `submission-${Date.now()}`
  const safeName = sanitizeFileName(rawName)
  const extension = safeName.includes('.') ? safeName.slice(safeName.lastIndexOf('.')) : ''
  const storagePath = `${task.id}/${Date.now()}-${randomUUID().slice(0, 8)}${extension}`
  const contentType = file.type || 'application/octet-stream'
  const isAgency = isAgencyCompanyType(normalizeCompanyType(user.companyType))

  try {
    if (isAgency) {
      const support = await getProjectMediaSupport()
      if (!support.hasTaskSubmissionCloudinaryColumns) {
        return NextResponse.json(
          { error: 'Cloudinary task submission fields are not ready. Apply the latest database migration first.' },
          { status: 503 }
        )
      }

      const validation = validateAgencyMediaFile({ mimeType: contentType, size: buffer.length })
      if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
      if (buffer.length > AGENCY_MEDIA_LIMITS.standardUpload) {
        return NextResponse.json({ error: 'Use the campaign media library for files larger than 25MB.' }, { status: 413 })
      }

      const result = await uploadAgencyMediaBuffer({
        buffer,
        companyId: user.companyId!,
        projectId: task.projectId,
        type: validation.type,
        fileName: safeName,
      })
      const urls = getCloudinaryDeliveryUrls(result, validation.type)

      const submission = await prisma.$transaction(async (tx) => {
        const versionNumber = (await tx.deliverableFile.count({ where: { deliverableId: task.deliverableId } })) + 1
        const created = await tx.taskSubmission.create({
          data: {
            taskId: task.id,
            userId: user.id,
            fileUrl: urls.url,
            fileName: safeName,
            fileType: contentType,
            mediaType: validation.type,
            fileSize: result.bytes ?? buffer.length,
            duration: typeof result.duration === 'number' ? result.duration : null,
            thumbnailUrl: urls.thumbnailUrl,
            playbackUrl: urls.playbackUrl,
            cloudinaryPublicId: result.public_id,
            note: typeof note === 'string' && note.trim() ? note.trim() : null,
          },
          select: {
            id: true,
            fileUrl: true,
            fileName: true,
            fileType: true,
            mediaType: true,
            fileSize: true,
            duration: true,
            thumbnailUrl: true,
            playbackUrl: true,
            cloudinaryPublicId: true,
            note: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        await tx.deliverableFile.create({
          data: {
            deliverableId: task.deliverableId,
            uploadedById: user.id,
            url: urls.url,
            playbackUrl: urls.playbackUrl,
            thumbnailUrl: urls.thumbnailUrl,
            cloudinaryPublicId: result.public_id,
            type: validation.type,
            mimeType: contentType,
            originalFilename: safeName,
            size: result.bytes ?? buffer.length,
            duration: typeof result.duration === 'number' ? result.duration : null,
            width: typeof result.width === 'number' ? result.width : null,
            height: typeof result.height === 'number' ? result.height : null,
            format: typeof result.format === 'string' ? result.format : null,
            versionNumber,
          },
        })

        await tx.deliverableRevision.upsert({
          where: { deliverableId_versionNumber: { deliverableId: task.deliverableId, versionNumber } },
          create: {
            deliverableId: task.deliverableId,
            versionNumber,
            status: 'CLIENT_REVIEW',
            changeNote: typeof note === 'string' && note.trim() ? note.trim() : 'Uploaded deliverable file',
          },
          update: {
            status: 'CLIENT_REVIEW',
            changeNote: typeof note === 'string' && note.trim() ? note.trim() : 'Uploaded deliverable file',
          },
        })

        await tx.deliverable.update({
          where: { id: task.deliverableId },
          data: { status: 'CLIENT_REVIEW', approvalState: 'PENDING', revisionCount: { increment: 1 } },
        })

        await tx.activity.create({
          data: {
            taskId: task.id,
            userId: user.id,
            action: 'Uploaded Cloudinary deliverable',
          },
        })

        return created
      })

      emitCompanyRealtime(task.project.companyId, 'task_submission_created', { projectId: task.projectId, taskId: task.id, submission })
      return NextResponse.json(submission, { status: 201 })
    }

    const supabase = getSupabaseAdmin()
    const { error: uploadError } = await supabase.storage.from(TASK_DELIVERABLE_BUCKET).upload(storagePath, buffer, {
      contentType,
      upsert: false,
    })

    if (uploadError) {
      console.error('Supabase task submission upload:', uploadError)
      return NextResponse.json(
        {
          error: 'Storage upload failed.',
          detail: uploadError.message,
          hint: `Create a public bucket named "${TASK_DELIVERABLE_BUCKET}" in Supabase Storage (or set SUPABASE_TASK_DELIVERABLE_BUCKET).`,
        },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(TASK_DELIVERABLE_BUCKET).getPublicUrl(storagePath)

    const submission = await prisma.$transaction(async (tx) => {
      const versionNumber = (await tx.deliverableFile.count({ where: { deliverableId: task.deliverableId } })) + 1
      const created = await tx.taskSubmission.create({
        data: {
          taskId: task.id,
          userId: user.id,
          fileUrl: publicUrl,
          fileName: safeName,
          fileType: contentType,
          note: typeof note === 'string' && note.trim() ? note.trim() : null,
        },
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          fileType: true,
          note: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      await tx.deliverableFile.create({
        data: {
          deliverableId: task.deliverableId,
          uploadedById: user.id,
          url: publicUrl,
          type: contentType.startsWith('video/') ? 'video' : contentType.startsWith('audio/') ? 'audio' : contentType.startsWith('image/') ? 'image' : 'file',
          mimeType: contentType,
          originalFilename: safeName,
          size: buffer.length,
          versionNumber,
        },
      })

      await tx.deliverableRevision.upsert({
        where: { deliverableId_versionNumber: { deliverableId: task.deliverableId, versionNumber } },
        create: {
          deliverableId: task.deliverableId,
          versionNumber,
          status: 'CLIENT_REVIEW',
          changeNote: typeof note === 'string' && note.trim() ? note.trim() : 'Uploaded deliverable file',
        },
        update: {
          status: 'CLIENT_REVIEW',
          changeNote: typeof note === 'string' && note.trim() ? note.trim() : 'Uploaded deliverable file',
        },
      })

      await tx.deliverable.update({
        where: { id: task.deliverableId },
        data: { status: 'CLIENT_REVIEW', approvalState: 'PENDING', revisionCount: { increment: 1 } },
      })

      await tx.activity.create({
        data: {
          taskId: task.id,
          userId: user.id,
          action: 'Uploaded deliverable',
        },
      })

      return created
    })

    emitCompanyRealtime(task.project.companyId, 'task_submission_created', { projectId: task.projectId, taskId: task.id, submission })

    return NextResponse.json(submission, { status: 201 })
  } catch (error) {
    console.error('[task-submission-upload]', {
      taskId: task.id,
      projectId: task.projectId,
      userId: user.id,
      contentType,
      size: buffer.length,
      error,
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload deliverable.' },
      { status: 500 }
    )
  }
}
