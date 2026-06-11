/**
 * fix-codemod-artifacts.ts
 *
 * The codemod left several broken variable references in route files:
 * 1. `_req` — should be `req` (renamed by codemod but body kept old name)
 * 2. `ctx` (standalone) — references to the old Next.js context object, now `{ params }` in withApiHandler
 * 3. `ctx.params` — already fixed by previous script, but any remaining
 *
 * Strategy:
 * - For `_req`: replace `_req` with `req` in body (the signature already has `req`)
 * - For `ctx` (when used as the Next.js RouteContext / second param of GET/POST): 
 *   We look for `handleApiRoute(..., ctx, ...)` calls and replace with `handleApiRoute(..., undefined, ...)`
 *   since these are now inside withApiHandler which already handles auth.
 *   We also look for `ctx.params` -> `params`
 */

import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'glob'

const routeFiles = globSync('src/app/api/**/route.ts')
let fixedCount = 0

for (const file of routeFiles) {
  const original = readFileSync(file, 'utf8')
  let updated = original

  // Fix `_req` -> `req`
  updated = updated.replace(/\b_req\b/g, 'req')

  // Fix `ctx.params` -> `params` (in case any remain)
  updated = updated.replace(/\bctx\.params\b/g, 'params')

  // Fix `handleApiRoute(\n...\nctx,` — the 2nd arg `ctx` is undefined in withApiHandler context
  // Pattern: handleApiRoute(\n?  req,\n?  ctx,
  updated = updated.replace(
    /(handleApiRoute\(\s*\n?\s*req\s*,\s*\n?\s*)ctx(\s*,)/g,
    '$1undefined$2'
  )

  // Fix standalone `ctx` used as route context param (where it's passed to handleApiRoute as second arg)
  // More aggressive: any line that is just `ctx,` inside a handleApiRoute call
  // Already covered above but let's also handle single-line version
  updated = updated.replace(
    /(handleApiRoute\([^)]*?req\s*,\s*)ctx(\s*,)/g,
    '$1undefined$2'
  )

  if (updated !== original) {
    writeFileSync(file, updated)
    fixedCount++
    console.log(`Fixed: ${file}`)
  }
}

console.log(`\nTotal fixed: ${fixedCount} files`)
