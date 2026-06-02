import { NextRequest } from 'next/server'
import { API_RATE_LIMITS } from '@/lib/api-defaults'
import { cached } from '@/lib/cache'
import { requireSessionUser } from '@/modules/shared/session'
import { okJson, withApiError } from '@/modules/shared/api'
import { searchWorkspace } from '@/modules/search/search.service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return withApiError(
    req,
    async () => {
      const user = await requireSessionUser()
      const query = req.nextUrl.searchParams.get('q')?.trim() ?? ''
      const cacheKey = `search:${user.companyId}:${user.id}:${query.toLowerCase()}`
      const results = await cached(cacheKey, 15, () => searchWorkspace(user, query))
      return okJson({ items: results })
    },
    { rateLimit: API_RATE_LIMITS.read, route: '/api/search' }
  )
}
