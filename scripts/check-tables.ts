import { prisma } from '@/lib/db'

async function main() {
  const rows = await prisma.$queryRaw<{tablename:string}[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  rows.forEach(r => console.log(r.tablename))
}
main().finally(() => prisma.$disconnect())
