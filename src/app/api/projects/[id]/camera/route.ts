import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getProjectIfAllowed } from '@/lib/project-access'
import { getProjectCameraSupport } from '@/lib/project-camera-support'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
const { id: projectId } = await params

const project = await getProjectIfAllowed(projectId, user)
if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

if (!project.hasCamera) {
return NextResponse.json({ error: 'Camera is not enabled for this project' }, { status: 403 })
}

const support = await getProjectCameraSupport()
if (!support.hasCameraMediaTable) {
return NextResponse.json([])
}

const media = await prisma.projectCameraMedia.findMany({
where: { projectId },
orderBy: { createdAt: 'desc' },
})

return NextResponse.json(media)
}, { auth: 'required' });
