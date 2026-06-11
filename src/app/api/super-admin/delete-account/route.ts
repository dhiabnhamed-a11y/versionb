import { NextRequest, NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { isAuthorizedSuperAdminIdentity } from '@/lib/security'
import { prisma } from '@/lib/db'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

const CONFIRMATION_CODE = '11193708'

export const POST = withApiHandler(async ({ req, params }) => {
const actor = await requireSessionUser()
if (!actor.id || !isAuthorizedSuperAdminIdentity(actor)) {
return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

try {
const body = (await req.json()) as { userId?: string; confirmationCode?: string }

if (!body.userId) {
  return NextResponse.json({ error: 'userId is required.' }, { status: 400 })
}

if (body.confirmationCode !== CONFIRMATION_CODE) {
  return NextResponse.json({ error: 'Invalid confirmation code.' }, { status: 403 })
}

const user = await prisma.user.findUnique({
  where: { id: body.userId },
  include: { ownedCompany: true },
})

if (!user) {
  return NextResponse.json({ error: 'User not found.' }, { status: 404 })
}

if (user.role === 'SUPER_ADMIN') {
  return NextResponse.json({ error: 'Cannot delete a super admin account.' }, { status: 403 })
}

await prisma.$transaction(async (tx) => {
  await tx.authSession.updateMany({
    where: { userId: user.id, status: 'ACTIVE' },
    data: { status: 'FORCED_LOGOUT', forcedLogoutAt: new Date(), revokedAt: new Date() },
  })

  if (user.ownedCompany) {
    await tx.user.updateMany({
      where: { companyId: user.ownedCompany.id },
      data: { companyId: null },
    })

    await tx.company.delete({ where: { id: user.ownedCompany.id } })
  } else if (user.companyId) {
    await tx.user.update({ where: { id: user.id }, data: { companyId: null } })
  }

  await tx.mfaFactor.deleteMany({ where: { userId: user.id } })
  await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } })
  await tx.authSession.deleteMany({ where: { userId: user.id } })
  await tx.revokedToken.updateMany({ where: { userId: user.id }, data: { userId: null } })
  await tx.user.delete({ where: { id: user.id } })
})

return NextResponse.json({ success: true, deletedUser: { id: user.id, email: user.email, name: user.name } })
} catch (error) {
console.error('Failed to delete account:', error)
return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 })
}
}, { auth: 'required' });
