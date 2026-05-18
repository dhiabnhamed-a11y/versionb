import { globSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const files = globSync('src/app/api/**/route.ts', { cwd: root })

for (const relativePath of files) {
  const file = join(root, relativePath)
  let source = readFileSync(file, 'utf8')
  if (!source.includes('await auth()')) continue

  if (!source.includes('requireSessionUser')) {
    source = `import { requireSessionUser } from '@/modules/shared/session'\n${source}`
  }

  source = source.replace(/const session = await auth\(\)/g, 'const user = await requireSessionUser()')
  source = source.replace(/if \(!session(?:\?\.user)?\) return NextResponse\.json\(\{ error: ['"]Unauthorized['"] \}, \{ status: 401 \}\)\s*\r?\n/g, '')
  source = source.replace(/const user = user as /g, 'const typedUser = user as ')
  source = source.replace(/session\.user\.id/g, 'user.id')
  source = source.replace(/session\.user/g, 'user')
  source = source.replace(/session\?\.user/g, 'user')
  source = source.replace(/if \(!session\) return/g, 'if (!user) return')

  writeFileSync(file, source)
  console.log('pass2', relativePath)
}
