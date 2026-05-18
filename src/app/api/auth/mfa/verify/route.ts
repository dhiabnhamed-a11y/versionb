import { apiRoute } from '@/lib/api/handler'
import { prisma } from '@/lib/db'
import { decryptMfaSecret } from '@/lib/security/mfa-crypto'
import { verifyTotpCode } from '@/modules/security/mfa'
import { badRequest } from '@/modules/shared/errors'

export const POST = apiRoute(async ({ user, req }) => {
  const body = (await req.json().catch(() => ({}))) as { code?: string }
  if (!body.code?.trim()) throw badRequest('Verification code required.')

  const factor = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, type: 'TOTP', status: { in: ['PENDING', 'ACTIVE'] } },
  })
  if (!factor?.secretCiphertext) throw badRequest('MFA enrollment not started.')

  const secret = decryptMfaSecret(factor.secretCiphertext)
  if (!verifyTotpCode({ code: body.code, secret })) throw badRequest('Invalid verification code.')

  await prisma.mfaFactor.update({
    where: { id: factor.id },
    data: { status: 'ACTIVE', verifiedAt: new Date() },
  })

  return { enabled: true }
}, { auth: 'required' })
