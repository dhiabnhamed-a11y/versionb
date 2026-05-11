import { NextRequest } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { okJson, withApiError } from '@/modules/shared/api'
import { searchWorkspace } from '@/modules/search/search.service'

export async function GET(req: NextRequest) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const query = req.nextUrl.searchParams.get('q')
    const results = await searchWorkspace(user, query)
    return okJson({ items: results })
  })
}
