import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const ownerPw = await bcrypt.hash('password123', 12)
  const owner = await prisma.user.upsert({
    where: { email: 'owner@taskforce.com' },
    update: {},
    create: { name: 'Alex Johnson', email: 'owner@taskforce.com', password: ownerPw, role: 'OWNER' },
  })

  const company = await prisma.company.upsert({
    where: { ownerId: owner.id },
    update: {},
    create: { name: 'TaskForce Inc.', ownerId: owner.id },
  })

  await prisma.user.update({ where: { id: owner.id }, data: { companyId: company.id } })

  const mgPw = await bcrypt.hash('password123', 12)
  const manager = await prisma.user.upsert({
    where: { email: 'manager@taskforce.com' },
    update: {},
    create: { name: 'Sarah Chen', email: 'manager@taskforce.com', password: mgPw, role: 'MANAGER', companyId: company.id },
  })

  const empPw = await bcrypt.hash('password123', 12)
  const emp1 = await prisma.user.upsert({
    where: { email: 'emp1@taskforce.com' },
    update: {},
    create: { name: 'Mike Rivera', email: 'emp1@taskforce.com', password: empPw, role: 'EMPLOYEE', companyId: company.id },
  })
  const emp2 = await prisma.user.upsert({
    where: { email: 'emp2@taskforce.com' },
    update: {},
    create: { name: 'Priya Patel', email: 'emp2@taskforce.com', password: empPw, role: 'EMPLOYEE', companyId: company.id },
  })

  const p1 = await prisma.project.upsert({
    where: { id: 'proj-1' },
    update: {},
    create: { id: 'proj-1', title: 'Website Redesign', description: 'Full company website overhaul', companyId: company.id, managerId: manager.id },
  })
  const p2 = await prisma.project.upsert({
    where: { id: 'proj-2' },
    update: {},
    create: { id: 'proj-2', title: 'Mobile App Launch', description: 'Q2 mobile app release', companyId: company.id, managerId: manager.id },
  })

  const taskDefs = [
    { id: 't-1', title: 'Design new landing page', priority: 'HIGH', stage: 'IN_PROGRESS', progress: 40, assigneeId: emp1.id, projectId: p1.id, deadline: new Date(Date.now() + 86400000 * 3) },
    { id: 't-2', title: 'Fix navigation bug', priority: 'CRITICAL', stage: 'TODO', progress: 0, assigneeId: emp1.id, projectId: p1.id, deadline: new Date(Date.now() + 86400000) },
    { id: 't-3', title: 'Write API documentation', priority: 'MEDIUM', stage: 'REVIEW', progress: 75, assigneeId: emp2.id, projectId: p2.id, deadline: new Date(Date.now() + 86400000 * 7) },
    { id: 't-4', title: 'Implement push notifications', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: emp2.id, projectId: p2.id, deadline: new Date(Date.now() - 86400000 * 2) },
    { id: 't-5', title: 'User testing session setup', priority: 'LOW', stage: 'TODO', progress: 0, assigneeId: emp1.id, projectId: p2.id, deadline: new Date(Date.now() + 86400000 * 14) },
  ]

  for (const t of taskDefs) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, description: `${t.title} — detailed implementation task` },
    })
    await prisma.activity.create({
      data: { taskId: t.id, userId: t.assigneeId, action: t.stage === 'DONE' ? 'Task completed' : 'Task created' },
    })
  }

  console.log('✅ Seed complete!\n')
  console.log('Demo accounts (password: password123):')
  console.log('  👑 Owner:    owner@taskforce.com')
  console.log('  🧑‍💼 Manager:  manager@taskforce.com')
  console.log('  👷 Employee: emp1@taskforce.com')
  console.log('  👷 Employee: emp2@taskforce.com')
}

main().catch(console.error).finally(() => prisma.$disconnect())
