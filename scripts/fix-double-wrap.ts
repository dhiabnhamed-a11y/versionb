import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'glob'

const routeFiles = globSync('src/app/api/**/route.ts')

let fixedCount = 0

for (const file of routeFiles) {
  let content = readFileSync(file, 'utf8')
  let changed = false

  // We look for the pattern:
  // export const METHOD = withApiHandler(async ({ req, params }) => {
  // return handleApiRoute(
  // reqName,
  // ctxName,
  
  const re = /export const (GET|POST|PUT|PATCH|DELETE) = withApiHandler\(async \(\{ req, params \}\) => \{\n\s*return handleApiRoute\(\n\s*([a-zA-Z0-9_]+),\n\s*([a-zA-Z0-9_]+),/g

  content = content.replace(re, (match, method, reqName, ctxName) => {
    changed = true
    return `export async function ${method}(${reqName}: NextRequest, ${ctxName}: any) {\n  return handleApiRoute(\n    ${reqName},\n    ${ctxName},`
  })

  // We also need to remove the closing `\n}, { auth: 'required' });` that withApiHandler added
  if (changed) {
    // This is tricky because of nesting, but since the codemod just appended it at the end of the original function body,
    // the original function body ended with `\n}`, and codemod replaced it with `\n}, { auth: 'required' });`
    // Wait, the codemod did: `fnDecl.replaceWithText(newStmt)`
    // And newStmt was `export const ${name} = withApiHandler(async (${paramStr}) => {\n${body}\n}, { auth: 'required' });`
    // So `\n}, { auth: 'required' });` is literally at the very end of the method.
    // Let's replace `\n}, { auth: 'required' });\n` with `\n}\n` or similar.
    content = content.replace(/\n\}, \{ auth: 'required' \}\);/g, '\n}')
    
    // Also remove the `import { withApiHandler } from "@/lib/api/handler";` that the codemod added
    content = content.replace(/import \{ withApiHandler \} from "@\/lib\/api\/handler";\n/g, '')

    writeFileSync(file, content)
    fixedCount++
  }
}

console.log(`Fixed ${fixedCount} double-wrapped route files.`)
