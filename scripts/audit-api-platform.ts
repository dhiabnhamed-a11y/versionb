import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { apiRouteContracts } from '../src/lib/api/openapi'

type RouteFinding = {
  file: string
  issue: string
  severity: 'error' | 'warn'
}

const root = process.cwd()
const apiRoot = path.join(root, 'src', 'app', 'api')
const routeMethodPattern = /export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)/g

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry)
    if (statSync(fullPath).isDirectory()) return walk(fullPath)
    return fullPath.endsWith(`${path.sep}route.ts`) ? [fullPath] : []
  })
}

function relative(file: string) {
  return path.relative(root, file).replaceAll(path.sep, '/')
}

function apiPathFromRouteFile(file: string) {
  const relativePath = relative(file)
  return relativePath
    .replace(/^src\/app\/api\/v1/, '')
    .replace(/\/route\.ts$/, '')
    .replace(/\[([^\]]+)\]/g, '{$1}')
    .replace(/\\/g, '/')
}

function exportedMethods(source: string) {
  const methods = new Set<string>()
  for (const match of source.matchAll(routeMethodPattern)) methods.add(match[1].toLowerCase())
  return [...methods]
}

const routeFiles = walk(apiRoot)
const v1RouteFiles = routeFiles.filter((file) => relative(file).startsWith('src/app/api/v1/'))
const legacyRouteFiles = routeFiles.filter((file) => !relative(file).startsWith('src/app/api/v1/'))
const contractKeys = new Set(apiRouteContracts.map((contract) => `${contract.method.toLowerCase()} ${contract.path}`))
const findings: RouteFinding[] = []

let rawNextResponseRoutes = 0
let directDatabaseRoutes = 0
let handleApiRouteRoutes = 0

for (const file of routeFiles) {
  const source = readFileSync(file, 'utf8')
  const fileLabel = relative(file)
  const isV1 = fileLabel.startsWith('src/app/api/v1/')
  const isOpenApiRoute = fileLabel === 'src/app/api/v1/openapi/route.ts'
  const directDatabase = /@\/lib\/db|new\s+PrismaClient|[^A-Za-z0-9_]prisma\./.test(source)
  const rawNextResponse = /NextResponse\.json|Response\.json/.test(source)
  const usesHandler = /handleApiRoute/.test(source)

  if (rawNextResponse) rawNextResponseRoutes += 1
  if (directDatabase) directDatabaseRoutes += 1
  if (usesHandler) handleApiRouteRoutes += 1

  if (isV1 && !isOpenApiRoute) {
    if (!usesHandler) findings.push({ file: fileLabel, issue: 'Canonical v1 route does not use handleApiRoute.', severity: 'error' })
    if (directDatabase) findings.push({ file: fileLabel, issue: 'Canonical v1 route touches Prisma/database directly.', severity: 'error' })
    if (!/responseMode:\s*['"]canonical['"]/.test(source)) {
      findings.push({ file: fileLabel, issue: 'Canonical v1 route does not explicitly use canonical response mode.', severity: 'error' })
    }

    const mutationMethods = exportedMethods(source).filter((method) => ['post', 'put', 'patch', 'delete'].includes(method))
    const hasIdempotency = /\bidempotency\s*:/.test(source) || /runIdempotent\s*\(/.test(source)
    if (mutationMethods.length > 0 && !hasIdempotency) {
      findings.push({
        file: fileLabel,
        issue: `Canonical v1 route exposes mutating method(s) [${mutationMethods.join(', ')}] without idempotency.`,
        severity: 'error',
      })
    }

    const routePath = apiPathFromRouteFile(file)
    for (const method of exportedMethods(source)) {
      const contractKey = `${method} ${routePath}`
      if (!contractKeys.has(contractKey)) {
        findings.push({ file: fileLabel, issue: `Missing OpenAPI route contract for ${contractKey}.`, severity: 'error' })
      }
    }
  }

  if (!isV1 && directDatabase) {
    findings.push({ file: fileLabel, issue: 'Legacy compatibility route still owns database access.', severity: 'warn' })
  }
}

const summary = {
  routeFiles: routeFiles.length,
  canonicalV1RouteFiles: v1RouteFiles.length,
  legacyRouteFiles: legacyRouteFiles.length,
  handleApiRouteRoutes,
  rawNextResponseRoutes,
  directDatabaseRoutes,
  openApiContracts: apiRouteContracts.length,
  errors: findings.filter((finding) => finding.severity === 'error').length,
  warnings: findings.filter((finding) => finding.severity === 'warn').length,
}

console.log(JSON.stringify({ summary, findings }, null, 2))

if (summary.errors > 0) {
  process.exitCode = 1
}
