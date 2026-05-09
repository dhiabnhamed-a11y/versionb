import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { getCameraForUser, toCameraDto } from '@/lib/camera-access'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string; companyId?: string | null }
  const { id } = await params
  const result = await getCameraForUser(id, user)

  if (!result) return NextResponse.json({ error: 'Camera not found.' }, { status: 404 })

  return NextResponse.json(toCameraDto(result.camera))
}
