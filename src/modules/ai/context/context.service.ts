import 'server-only'

import type { AiActor } from '@/modules/ai/dto/runtime.dto'

export type AiRuntimeContext = {
  actor: AiActor
  workspace: {
    companyId: string
    locale: 'en' | 'fr' | 'ar'
    timezone: string
  }
  governance: {
    dryRunRequired: true
    confirmationRequiredForMutations: true
    auditRequired: true
    rollbackMetadataRequired: true
  }
}

export function buildAiRuntimeContext(input: {
  actor: AiActor
  timezone?: string | null
}): AiRuntimeContext {
  return {
    actor: input.actor,
    workspace: {
      companyId: input.actor.companyId,
      locale: input.actor.locale,
      timezone: input.timezone ?? 'UTC',
    },
    governance: {
      dryRunRequired: true,
      confirmationRequiredForMutations: true,
      auditRequired: true,
      rollbackMetadataRequired: true,
    },
  }
}
