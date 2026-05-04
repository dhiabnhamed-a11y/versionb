import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  commentSelect,
  getAllowedCommentFile,
  normalizeCommentContent,
  normalizeTimestamp,
  timestampFitsDuration,
} from '@/lib/media-comments'
import type { SessionUser } from '@/lib/project-access'

type CreateCommentBody = {
  fileId?: string
  content?: string
  timestamp?: number
  parentId?: string | null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  const body = (await req.json().catch(() => ({}))) as CreateCommentBody
  const fileId = body.fileId?.trim()
  if (!fileId) return NextResponse.json({ error: 'fileId is required.' }, { status: 400 })

  const file = await getAllowedCommentFile(fileId, user)
  if (!file) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

  const content = normalizeCommentContent(body.content)
  if (!content) return NextResponse.json({ error: 'Comment content is required.' }, { status: 400 })

  let parentId: string | null = null
  let timestamp = normalizeTimestamp(body.timestamp)

  if (body.parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: body.parentId, fileId: file.id },
      select: { id: true, parentId: true, timestamp: true },
    })
    if (!parent) return NextResponse.json({ error: 'Parent comment not found.' }, { status: 404 })

    parentId = parent.parentId ?? parent.id
    timestamp = parent.timestamp
  }

  if (timestamp === null) return NextResponse.json({ error: 'A valid timestamp is required.' }, { status: 400 })
  if (!timestampFitsDuration(timestamp, file.duration)) {
    return NextResponse.json({ error: 'Comment timestamp is outside the media duration.' }, { status: 400 })
  }

  const comment = await prisma.comment.create({
    data: {
      fileId: file.id,
      userId: user.id,
      content,
      timestamp,
      parentId,
    },
    select: commentSelect,
  })

  return NextResponse.json(comment, { status: 201 })
}
