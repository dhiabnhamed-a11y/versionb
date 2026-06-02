import { apiRoute } from '@/lib/api/handler'
import { prisma } from '@/lib/db'
import { encryptMfaSecret } from '@/lib/security/mfa-crypto'
import { buildTotpUri, generateRecoveryCodes, generateTotpSecret } from '@/modules/security/mfa'
import { createHash } from 'crypto'

export const runtime = 'nodejs'
export const POST = apiRoute(async ({ user }) => {
  const secret = generateTotpSecret()
  const existing = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, type: 'TOTP' },
    select: { id: true },
  })
  const factor = existing
    ? await prisma.mfaFactor.update({
        where: { id: existing.id },
        data: { status: 'PENDING', secretCiphertext: encryptMfaSecret(secret), label: user.email ?? user.id },
      })
    : await prisma.mfaFactor.create({
        data: {
          userId: user.id,
          type: 'TOTP',
          status: 'PENDING',
          secretCiphertext: encryptMfaSecret(secret),
          label: user.email ?? user.id,
        },
      })

  const codes = generateRecoveryCodes()
  await prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id, usedAt: null } })
  await prisma.mfaRecoveryCode.createMany({
    data: codes.map((code) => ({
      userId: user.id,
      codeHash: createHash('sha256').update(code).digest('hex'),
    })),
  })

  return {
    factorId: factor.id,
    otpauthUrl: buildTotpUri({ accountName: user.email ?? user.id, secret }),
    recoveryCodes: codes,
  }
}, { auth: 'required' })
