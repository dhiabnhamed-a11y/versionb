import { globSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const files = globSync(join('src', 'app', 'api', '**', 'route.ts').replace(/\\/g, '/'), { cwd: root })
console.log(`scanning ${files.length} routes`)

for (const relativePath of files) {
  const file = join(root, relativePath)
  let source = readFileSync(file, 'utf8')
  if (!source.includes('await auth()')) continue

  const skip = ['/api/auth/', '/api/health', '/api/ready', '/api/client-portal/', '/api/integrations/webhooks']
  if (skip.some((segment) => relativePath.replace(/\\/g, '/').includes(segment))) continue

  source = source.replace(/import\s+\{\s*auth\s*,\s*/g, 'import { ')
  source = source.replace(/,\s*auth\s*\}/g, ' }')
  source = source.replace(/import\s+\{\s*auth\s*\}\s+from\s+'@\/lib\/auth'\s*\n/g, '')

  if (!source.includes("requireSessionUser")) {
    source = `import { requireSessionUser } from '@/modules/shared/session'\n${source}`
  }

  source = source.replace(
    /const session = await auth\(\)\s*\r?\n\s*if \(!session(?:\?\.user)?\) return NextResponse\.json\(\{ error: ['"]Unauthorized['"] \}, \{ status: 401 \}\)\s*\r?\n\s*const user = (?:session\.user|session\?\.user) as [^\r\n]+\r?\n/g,
    'const user = await requireSessionUser()\n'
  )

  source = source.replace(
    /const session = await auth\(\)\s*\r?\n\s*if \(!session\) return NextResponse\.json\(\{ error: ['"]Unauthorized['"] \}, \{ status: 401 \}\)\s*\r?\n/g,
    'const user = await requireSessionUser()\n'
  )

  source = source.replace(
    /const session = await auth\(\)\s*\r?\n\s*if \(!session\?\.user\) return NextResponse\.json\(\{ error: ['"]Unauthorized['"] \}, \{ status: 401 \}\)\s*\r?\n/g,
    'const user = await requireSessionUser()\n'
  )

  source = source.replace(/session\.user\.id/g, 'user.id')
  source = source.replace(/session\.user/g, 'user')
  source = source.replace(/session\?\.user/g, 'user')

  writeFileSync(file, source)
  console.log('migrated', relativePath)
}
