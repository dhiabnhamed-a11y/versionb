import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Initializing EMS configuration...')
  console.log('  Note: No mock data is created. The EMS system starts empty.')
  console.log('  Data is ingested through real integrations (CAD, EHR, webhooks).')

  // Attach EmsCompany config to first available company for EMS access
  let company = await prisma.company.findFirst({ where: { name: 'TaskForce Inc.' } })
  if (!company) {
    company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } })
  }
  if (!company) {
    console.log('No company found. Run prisma/seed.ts first.')
    return
  }
  const companyId = company.id

  // Create minimal EMS company configuration (empty, ready for live connections)
  await prisma.emsCompany.upsert({
    where: { companyId },
    create: {
      companyId,
      dispatchMode: 'manual',
      enableAiClassification: true,
      enableAutoDispatch: false,
      enablePredictiveAlerts: false,
      responseTimeTarget: 420,
    },
    update: {
      dispatchMode: 'manual',
      enableAutoDispatch: false,
    },
  })
  console.log(`  EMS configuration ready for company ${companyId}`)
  console.log('  System is empty — connect real integrations via Integrations UI.')
  console.log('EMS initialization complete!')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
