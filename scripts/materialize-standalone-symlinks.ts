import { cp, lstat, realpath, rm } from 'fs/promises'
import path from 'path'

const standaloneDir = path.join(process.cwd(), '.next', 'standalone')

async function materializeEntry(entryPath: string) {
  const stats = await lstat(entryPath)
  if (!stats.isSymbolicLink()) return false

  const target = await realpath(entryPath)
  await rm(entryPath, { recursive: true, force: true })
  await cp(target, entryPath, { recursive: true, dereference: true })
  return true
}

async function walk(dir: string): Promise<number> {
  const entries = await import('fs/promises').then(({ readdir }) => readdir(dir, { withFileTypes: true }))
  let materialized = 0

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    const stats = await lstat(entryPath)

    if (stats.isSymbolicLink()) {
      materialized += (await materializeEntry(entryPath)) ? 1 : 0
      continue
    }

    if (stats.isDirectory()) {
      materialized += await walk(entryPath)
    }
  }

  return materialized
}

async function main() {
  const count = await walk(standaloneDir)
  console.log(`Materialized ${count} standalone symlink${count === 1 ? '' : 's'}.`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
