import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { API_RATE_LIMITS } from '@/lib/api-defaults'
import { cached } from '@/lib/cache'
import { generateCfoCopilotBrief } from '@/modules/financial-ai/cfo-copilot.service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) =>
      apiData(
        await cached(`cfo-brief:${user.companyId ?? 'none'}`, 60, () => generateCfoCopilotBrief(user))
      ),
    { auth: 'required', responseMode: 'legacy', rateLimit: API_RATE_LIMITS.read }
  )
}
