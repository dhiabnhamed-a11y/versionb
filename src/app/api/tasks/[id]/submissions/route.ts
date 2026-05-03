import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { getSupabaseAdmin, TASK_DELIVERABLE_BUCKET } from '@/lib/supabase-admin'

type SessionUser = {
  id: string
  role: string
  companyId?: string | null
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
      title: true,
      project: { select: { companyId: true } },
    },
  })
}

export async function GET(_req: NextRequest, context: RouteContext<'/api/tasks/[id]/submissions'>) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as SessionUser
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

  return NextResponse.json(submissions)
}

export async function POST(req: NextRequest, context: RouteContext<'/api/tasks/[id]/submissions'>) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as SessionUser
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

  try {
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

    const submission = await prisma.taskSubmission.create({
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

    await prisma.activity.create({
      data: {
        taskId: task.id,
        userId: user.id,
        action: 'Uploaded deliverable',
      },
    })

    emitCompanyRealtime(task.project.companyId, 'task_submission_created', { taskId: task.id, submission })

    return NextResponse.json(submission, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to upload deliverable.' }, { status: 500 })
  }
}
