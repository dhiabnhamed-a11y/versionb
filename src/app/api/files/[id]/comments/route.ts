import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import { COMMENT_TIME_TOLERANCE_SECONDS, commentSelect, getAllowedCommentFile } from '@/lib/media-comments'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
const { id } = await params as { id: string }
const file = await getAllowedCommentFile(id, user)
if (!file) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

const comments = await prisma.comment.findMany({
where: { fileId: file.id },
select: commentSelect,
orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }],
})

return NextResponse.json(
{ comments, toleranceSeconds: COMMENT_TIME_TOLERANCE_SECONDS },
{ headers: NO_STORE_HEADERS }
)
}, { auth: 'required' });
