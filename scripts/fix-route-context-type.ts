/**
 * fix-route-context-type.ts
 *
 * Some files use `RouteContext<...>` which doesn't exist — the correct type is `ApiRouteContext<...>` from '@/lib/api'.
 * This replaces all occurrences of `RouteContext<` with `ApiRouteContext<` and adds the import if missing.
 */

import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'glob'

const routeFiles = globSync('src/app/api/**/route.ts')
let fixedCount = 0

for (const file of routeFiles) {
  const original = readFileSync(file, 'utf8')
  let updated = original

  if (!updated.includes('RouteContext')) continue

  // Replace RouteContext< with ApiRouteContext<
  updated = updated.replace(/\bRouteContext</g, 'ApiRouteContext<')

  // If ApiRouteContext is now used but not yet imported, add it to the @/lib/api import
  if (updated.includes('ApiRouteContext') && !original.includes('ApiRouteContext')) {
    // Add to existing @/lib/api import if present
    updated = updated.replace(
      /import \{([^}]+)\} from '@\/lib\/api'/,
      (match, imports) => {
        if (imports.includes('ApiRouteContext')) return match
        return `import {${imports.trimEnd()}, ApiRouteContext } from '@/lib/api'`
      }
    )
    // If no @/lib/api import exists, add a new one after the last import
    if (!updated.includes("from '@/lib/api'")) {
      updated = updated.replace(
        /(import[^\n]+\n)/,
        `$1import { ApiRouteContext } from '@/lib/api'\n`
      )
    }
  }

  if (updated !== original) {
    writeFileSync(file, updated)
    fixedCount++
    console.log(`Fixed: ${file}`)
  }
}

console.log(`\nTotal fixed: ${fixedCount} files`)
