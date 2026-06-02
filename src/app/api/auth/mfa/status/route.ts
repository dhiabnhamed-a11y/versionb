import { apiRoute } from '@/lib/api/handler'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export const GET = apiRoute(async ({ user }) => {
  const factor = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    select: { id: true, type: true, verifiedAt: true },
  })
  return { enabled: Boolean(factor), type: factor?.type ?? null }
}, { auth: 'required' })
