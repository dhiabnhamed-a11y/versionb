import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { canManageProjectCamera } from '@/lib/camera-access'
import { testRtspConnection } from '@/lib/camera-rtsp'
import { buildRtspUrl } from '@/lib/camera-rtsp-url'
import { normalizeCameraInput } from '@/lib/camera-validation'
import { getProjectIfAllowed } from '@/lib/project-access'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
if (!canManageProjectCamera(user)) {
return NextResponse.json({ error: 'Only owners and managers can test project cameras.' }, { status: 403 })
}

const parsed = normalizeCameraInput(await req.json().catch(() => ({})))
if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

const project = await getProjectIfAllowed(parsed.value.projectId, user)
if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

const rtspUrl = buildRtspUrl(parsed.value)

try {
await testRtspConnection(rtspUrl)
return NextResponse.json({ ok: true, status: 'ONLINE' })
} catch (error) {
return NextResponse.json(
  {
    ok: false,
    status: 'OFFLINE',
    error: error instanceof Error ? error.message : 'Camera test failed.',
  },
  { status: 422 }
)
}
}, { auth: 'required' });
