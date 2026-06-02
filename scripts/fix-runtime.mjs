import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'glob'

const files = globSync('src/app/api/**/*.ts', { cwd: process.cwd() })

let fixed = 0
let skipped = 0

for (const file of files) {
  const content = readFileSync(file, 'utf8')

  // Already has runtime declaration
  if (content.includes("runtime = 'nodejs'") || content.includes('runtime = "nodejs"')) {
    skipped++
    continue
  }

  // Only add if the file uses Prisma, Node built-ins, or service modules
  const needsRuntime =
    content.includes("from '@/lib/db'") ||
    content.includes("from '@/modules/") ||
    content.includes("from '@/lib/") ||
    content.includes("from 'crypto'") ||
    content.includes("from 'fs'") ||
    content.includes("from 'fs/promises'") ||
    content.includes("from 'path'") ||
    content.includes("from 'os'") ||
    content.includes("from 'stream'") ||
    content.includes("from 'net'") ||
    content.includes('prisma')

  if (!needsRuntime) {
    skipped++
    continue
  }

  // Insert after the last import block
  // Find the first non-import, non-blank line after imports
  const lines = content.split('\n')
  let lastImportLine = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ') || (lines[i].startsWith('} from ') )) {
      lastImportLine = i
    }
  }

  let newContent
  if (lastImportLine >= 0) {
    const before = lines.slice(0, lastImportLine + 1).join('\n')
    const after = lines.slice(lastImportLine + 1).join('\n')
    newContent = before + "\n\nexport const runtime = 'nodejs'\n" + after
  } else {
    newContent = "export const runtime = 'nodejs'\n\n" + content
  }

  // Avoid double blank lines
  newContent = newContent.replace(/\n{3,}/g, '\n\n')

  writeFileSync(file, newContent, 'utf8')
  fixed++
  console.log(`✓ ${file}`)
}

console.log(`\nDone: ${fixed} fixed, ${skipped} skipped`)
