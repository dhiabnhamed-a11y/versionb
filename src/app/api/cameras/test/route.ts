import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { canManageProjectCamera } from '@/lib/camera-access'
import { buildRtspUrl, testRtspConnection } from '@/lib/camera-stream-manager'
import { normalizeCameraInput } from '@/lib/camera-validation'
import { getProjectIfAllowed } from '@/lib/project-access'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string; companyId?: string | null }
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
}
