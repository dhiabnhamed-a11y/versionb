import { Project, SyntaxKind, FunctionDeclaration } from 'ts-morph'
import fs from 'fs'

const project = new Project({
  tsConfigFilePath: './tsconfig.json',
})

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

let wrappedCount = 0

for (const sourceFile of project.getSourceFiles('src/app/api/**/route.ts')) {
  let modified = false

  for (const method of HTTP_METHODS) {
    const fnDecl = sourceFile.getFunction(method)
    if (fnDecl && fnDecl.isExported() && fnDecl.isAsync()) {
      // It's an exported async function (e.g. export async function GET...)
      const name = fnDecl.getName()
      const parameters = fnDecl.getParameters().map(p => p.getText())
      const body = fnDecl.getBodyText()

      if (!body) continue

      // Skip if already wrapped or uses internal helpers
      if (body.includes('withApiHandler') || body.includes('handleApiRoute') || body.includes('apiRoute')) {
        continue
      }

      // Convert to export const GET = withApiHandler(...)
      let paramStr = '{ req, params }'
      
      // Attempt to safely extract NextRequest and Context
      const newStmt = `export const ${name} = withApiHandler(async (${paramStr}) => {\n${body}\n}, { auth: 'required' });`
      
      fnDecl.replaceWithText(newStmt)
      modified = true
    }
  }

  if (modified) {
    // Check if withApiHandler is imported
    const hasImport = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === '@/lib/api/handler')
    if (!hasImport) {
      sourceFile.addImportDeclaration({
        namedImports: ['withApiHandler'],
        moduleSpecifier: '@/lib/api/handler'
      })
    }
    sourceFile.saveSync()
    wrappedCount++
  }
}

console.log(`Successfully wrapped ${wrappedCount} route files with withApiHandler.`)
