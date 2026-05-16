import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'
import { toJsonValue } from '@/modules/shared/json'
import type { AiRiskLevel } from '@/modules/ai/dto/runtime.dto'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function addMinutes(minutes: number) {
  const date = new Date()
  date.setMinutes(date.getMinutes() + minutes)
  return date
}

export async function requestAiApproval(input: {
  aiRunId?: string | null
  aiStepId?: string | null
  companyId: string
  requesterId: string
  approverId?: string | null
  approvalType: string
  riskLevel: AiRiskLevel
  reason: string
  preview?: unknown
  rollback?: unknown
  policy?: unknown
  expiresInMinutes?: number
}) {
  const token = randomBytes(32).toString('base64url')
  const approval = await prisma.aiApproval.create({
    data: {
      aiRunId: input.aiRunId ?? null,
      aiStepId: input.aiStepId ?? null,
      companyId: input.companyId,
      requesterId: input.requesterId,
      approverId: input.approverId ?? null,
      approvalType: input.approvalType,
      riskLevel: input.riskLevel,
      reason: input.reason,
      preview: toJsonValue(input.preview),
      rollback: toJsonValue(input.rollback),
      policy: toJsonValue(input.policy),
      tokenHash: hashToken(token),
      expiresAt: addMinutes(input.expiresInMinutes ?? 60),
    },
  })

  return { approval, token }
}
