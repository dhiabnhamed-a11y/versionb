import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'glob'
import path from 'path'

const files = globSync('src/**/*.{ts,tsx}')

let replaced = 0

for (const file of files) {
  if (file.includes('tenant-raw-query') || file.includes('prisma-context')) continue
  
  let content = readFileSync(file, 'utf8')
  let changed = false

  // We check if the file uses prisma.$queryRaw or prisma.$executeRaw or tx.$executeRaw etc.
  // Actually, delete-graph uses tx.$executeRaw where tx is a transaction object. 
  // We can't replace tx.$executeRaw with tenantExecuteRaw directly because tenantExecuteRaw uses `prisma.$executeRaw`.
  // Wait, if it's inside a transaction, the query must run on `tx`. 
  // Let's only replace `prisma.$queryRaw` and `prisma.$executeRaw`.
  
  if (content.includes('prisma.$queryRaw') || content.includes('prisma.$executeRaw')) {
    content = content.replace(/prisma\.\$queryRaw/g, 'tenantQueryRaw')
    content = content.replace(/prisma\.\$executeRaw/g, 'tenantExecuteRaw')
    
    // Add import
    const importStatement = `import { tenantQueryRaw, tenantExecuteRaw } from '@/lib/tenant/tenant-raw-query'\n`
    if (!content.includes('tenantQueryRaw')) {
      // insert after last import
      const lastImportMatch = [...content.matchAll(/^import .*$/gm)].pop()
      if (lastImportMatch) {
        const insertIndex = lastImportMatch.index! + lastImportMatch[0].length
        content = content.slice(0, insertIndex) + '\n' + importStatement + content.slice(insertIndex)
      } else {
        content = importStatement + content
      }
    }
    changed = true
  }

  if (changed) {
    writeFileSync(file, content)
    replaced++
  }
}

console.log(`Migrated raw SQL in ${replaced} files.`)
