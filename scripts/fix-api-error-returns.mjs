/**
 * Safe line-by-line fix: casts `return apiData({ error: ... }, { status: N })` calls
 * to `as unknown` so TypeScript doesn't infer TData = { error: string } from them.
 * This resolves the overload mismatch when a handler returns multiple apiData shapes.
 *
 * Only touches SINGLE-LINE returns. Does not touch multi-line or complex patterns.
 */
import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'glob'

const files = globSync('src/app/api/**/*.ts', { cwd: process.cwd() })

// Matches the full pattern on a SINGLE LINE:
// return apiData({ error: '<anything>' }, { status: N })
// return apiData({ error: '<anything>', ... }, { status: N })
// Does NOT match if the return already has `as unknown`
const RE = /^(\s*)(return apiData\(\{[^}]*error:[^}]*\},\s*\{[^}]*status:[^}]*\}\s*\))(\s*)$/

let fixed = 0
let skipped = 0

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  let changed = false

  const newLines = lines.map((line) => {
    // Skip if already has the cast
    if (line.includes('as unknown')) return line
    const m = RE.exec(line)
    if (!m) return line
    changed = true
    return `${m[1]}${m[2]} as unknown${m[3]}`
  })

  if (changed) {
    writeFileSync(file, newLines.join('\n'), 'utf8')
    const n = (newLines.join('\n').match(/as unknown/g) || []).length
    console.log(`✓ ${file}  (${n} casts)`)
    fixed++
  } else {
    skipped++
  }
}

console.log(`\nDone: ${fixed} fixed, ${skipped} skipped`)
