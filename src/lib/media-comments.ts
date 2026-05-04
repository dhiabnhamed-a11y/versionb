import { prisma } from '@/lib/db'
import { getProjectIfAllowed, type SessionUser } from '@/lib/project-access'

export const COMMENT_TIME_TOLERANCE_SECONDS = 0.5
export const MAX_COMMENT_LENGTH = 2000

export const commentSelect = {
  id: true,
  fileId: true,
  userId: true,
  content: true,
  timestamp: true,
  parentId: true,
  resolved: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
} as const

export type CommentFile = {
  id: string
  projectId: string
  type: string
  duration: number | null
  source: 'projectMedia' | 'taskSubmission'
}

export function normalizeCommentContent(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_COMMENT_LENGTH) : ''
}

export function normalizeTimestamp(value: unknown) {
  const timestamp = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : null
}

function isTimedMedia(type?: string | null) {
  return type === 'audio' || type === 'video'
}

export async function getAllowedCommentFile(fileId: string, user: SessionUser): Promise<CommentFile | null> {
  if (!user.companyId) return null

  const projectMedia = await prisma.projectMedia.findFirst({
    where: {
      id: fileId,
      project: { companyId: user.companyId },
    },
    select: {
      id: true,
      projectId: true,
      type: true,
      duration: true,
    },
  })

  if (projectMedia) {
    const project = await getProjectIfAllowed(projectMedia.projectId, user)
    if (!project || !isTimedMedia(projectMedia.type)) return null

    return {
      id: projectMedia.id,
      projectId: projectMedia.projectId,
      type: projectMedia.type,
      duration: projectMedia.duration,
      source: 'projectMedia',
    }
  }

  const submission = await prisma.taskSubmission.findFirst({
    where: {
      id: fileId,
      task: { project: { companyId: user.companyId } },
    },
    select: {
      id: true,
      mediaType: true,
      duration: true,
      task: { select: { projectId: true } },
    },
  })

  if (!submission) return null

  const project = await getProjectIfAllowed(submission.task.projectId, user)
  if (!project || !isTimedMedia(submission.mediaType)) return null

  return {
    id: submission.id,
    projectId: submission.task.projectId,
    type: submission.mediaType!,
    duration: submission.duration,
    source: 'taskSubmission',
  }
}

export function timestampFitsDuration(timestamp: number, duration?: number | null) {
  if (!duration || !Number.isFinite(duration)) return true
  return timestamp <= duration + COMMENT_TIME_TOLERANCE_SECONDS
}
