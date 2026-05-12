import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { NO_STORE_HEADERS } from '@/lib/http'
import { buildOperationalCommandCenter } from '@/modules/operations/operational-intelligence.service'

type SessionUser = {
  id?: string | null
  role?: string | null
  companyId?: string | null
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })
  }

  const user = session.user as SessionUser
  const commandCenter = await buildOperationalCommandCenter({
    id: user.id ?? '',
    role: user.role,
    companyId: user.companyId,
  })

  return NextResponse.json(commandCenter, { headers: NO_STORE_HEADERS })
}
