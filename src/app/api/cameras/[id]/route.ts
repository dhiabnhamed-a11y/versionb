import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { getCameraForUser, toCameraDto } from '@/lib/camera-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser()
  const { id } = await params
  const result = await getCameraForUser(id, user)

  if (!result) return NextResponse.json({ error: 'Camera not found.' }, { status: 404 })

  return NextResponse.json(toCameraDto(result.camera))
}
