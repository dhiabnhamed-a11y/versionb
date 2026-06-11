/**
 * Fix-ctx-params.ts
 * 
 * After the codemod wrapped routes with withApiHandler(async ({ req, params }) => { ... }),
 * some route bodies still referenced the old `ctx.params` pattern from their original
 * `export async function GET(req, ctx)` signature.
 *
 * This script replaces all occurrences of `ctx.params` with `params` inside those files.
 */

import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'glob'

const routeFiles = globSync('src/app/api/**/route.ts')
let fixedCount = 0

for (const file of routeFiles) {
  const original = readFileSync(file, 'utf8')
  
  // Replace ctx.params with params
  let updated = original.replace(/\bctx\.params\b/g, 'params')
  
  // Also fix `await ctx.params` -> `await params` (params in withApiHandler is already resolved)
  // Actually in withApiHandler, params is still a Promise<...> so keep the await
  // Just replace the `ctx.` prefix
  
  if (updated !== original) {
    writeFileSync(file, updated)
    fixedCount++
    console.log(`Fixed: ${file}`)
  }
}

console.log(`\nTotal fixed: ${fixedCount} files`)
