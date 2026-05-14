import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { generateCfoCopilotBrief } from '@/modules/financial-ai/cfo-copilot.service'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => apiData(await generateCfoCopilotBrief(user)), {
    auth: 'required',
    responseMode: 'legacy',
  })
}
