import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const ownerPw = await bcrypt.hash('password123', 12)
  const owner = await prisma.user.upsert({
    where: { email: 'owner@taskforce.com' },
    update: {
      role: 'OWNER',
      accountStatus: 'ACTIVE',
    },
    create: {
      name: 'Alex Johnson',
      email: 'owner@taskforce.com',
      password: ownerPw,
      role: 'OWNER',
      accountStatus: 'ACTIVE',
    },
  })

  const company = await prisma.company.upsert({
    where: { ownerId: owner.id },
    update: {
      name: 'TaskForce Inc.',
      emailDomain: 'taskforce.com',
      companyType: 'OTHER',
      country: 'Tunisia',
      industry: 'Operations',
      registrationNumber: 'TF-2026-001',
      status: 'ACTIVE',
    },
    create: {
      name: 'TaskForce Inc.',
      ownerId: owner.id,
      emailDomain: 'taskforce.com',
      companyType: 'OTHER',
      country: 'Tunisia',
      industry: 'Operations',
      registrationNumber: 'TF-2026-001',
      status: 'ACTIVE',
    },
  })

  await prisma.user.update({ where: { id: owner.id }, data: { companyId: company.id } })

  const mgPw = await bcrypt.hash('password123', 12)
  const manager = await prisma.user.upsert({
    where: { email: 'manager@taskforce.com' },
    update: {
      role: 'MANAGER',
      accountStatus: 'ACTIVE',
      companyId: company.id,
    },
    create: {
      name: 'Sarah Chen',
      email: 'manager@taskforce.com',
      password: mgPw,
      role: 'MANAGER',
      accountStatus: 'ACTIVE',
      companyId: company.id,
    },
  })

  const empPw = await bcrypt.hash('password123', 12)
  const emp1 = await prisma.user.upsert({
    where: { email: 'emp1@taskforce.com' },
    update: {
      role: 'EMPLOYEE',
      accountStatus: 'ACTIVE',
      companyId: company.id,
    },
    create: {
      name: 'Mike Rivera',
      email: 'emp1@taskforce.com',
      password: empPw,
      role: 'EMPLOYEE',
      accountStatus: 'ACTIVE',
      companyId: company.id,
    },
  })
  const emp2 = await prisma.user.upsert({
    where: { email: 'emp2@taskforce.com' },
    update: {
      role: 'EMPLOYEE',
      accountStatus: 'ACTIVE',
      companyId: company.id,
    },
    create: {
      name: 'Priya Patel',
      email: 'emp2@taskforce.com',
      password: empPw,
      role: 'EMPLOYEE',
      accountStatus: 'ACTIVE',
      companyId: company.id,
    },
  })

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? process.env.SUPER_ADMIN_EMAILS?.split(',')[0]?.trim()
  if (superAdminEmail) {
    const superAdminPw = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD ?? 'password123', 12)
    await prisma.user.upsert({
      where: { email: superAdminEmail.toLowerCase() },
      update: {
        role: 'SUPER_ADMIN',
        accountStatus: 'ACTIVE',
        companyId: null,
      },
      create: {
        name: 'Platform Super Admin',
        email: superAdminEmail.toLowerCase(),
        password: superAdminPw,
        role: 'SUPER_ADMIN',
        accountStatus: 'ACTIVE',
      },
    })
  }

  const p1 = await prisma.project.upsert({
    where: { id: 'proj-1' },
    update: {},
    create: {
      id: 'proj-1',
      title: 'Website Redesign',
      description: 'Full company website overhaul',
      companyId: company.id,
      managerId: manager.id,
    },
  })
  const p2 = await prisma.project.upsert({
    where: { id: 'proj-2' },
    update: {},
    create: {
      id: 'proj-2',
      title: 'Mobile App Launch',
      description: 'Q2 mobile app release',
      companyId: company.id,
      managerId: manager.id,
    },
  })

  const brief1 = await prisma.brief.upsert({
    where: { id: 'brief-proj-1' },
    update: {},
    create: {
      id: 'brief-proj-1',
      companyId: company.id,
      campaignId: p1.id,
      createdById: manager.id,
      title: 'Website Redesign brief',
      description: 'Imported planning brief for the website redesign campaign.',
      status: 'APPROVED',
      approvedAt: new Date(),
    },
  })

  const brief2 = await prisma.brief.upsert({
    where: { id: 'brief-proj-2' },
    update: {},
    create: {
      id: 'brief-proj-2',
      companyId: company.id,
      campaignId: p2.id,
      createdById: manager.id,
      title: 'Mobile App Launch brief',
      description: 'Imported planning brief for the mobile app launch campaign.',
      status: 'APPROVED',
      approvedAt: new Date(),
    },
  })

  const taskDefs = [
    {
      id: 't-1',
      title: 'Design new landing page',
      priority: 'HIGH',
      stage: 'IN_PROGRESS',
      progress: 40,
      assigneeId: emp1.id,
      projectId: p1.id,
      briefId: brief1.id,
      deadline: new Date(Date.now() + 86400000 * 3),
    },
    {
      id: 't-2',
      title: 'Fix navigation bug',
      priority: 'CRITICAL',
      stage: 'TODO',
      progress: 0,
      assigneeId: emp1.id,
      projectId: p1.id,
      briefId: brief1.id,
      deadline: new Date(Date.now() + 86400000),
    },
    {
      id: 't-3',
      title: 'Write API documentation',
      priority: 'MEDIUM',
      stage: 'REVIEW',
      progress: 75,
      assigneeId: emp2.id,
      projectId: p2.id,
      briefId: brief2.id,
      deadline: new Date(Date.now() + 86400000 * 7),
    },
    {
      id: 't-4',
      title: 'Implement push notifications',
      priority: 'HIGH',
      stage: 'DONE',
      progress: 100,
      assigneeId: emp2.id,
      projectId: p2.id,
      briefId: brief2.id,
      deadline: new Date(Date.now() - 86400000 * 2),
    },
    {
      id: 't-5',
      title: 'User testing session setup',
      priority: 'LOW',
      stage: 'TODO',
      progress: 0,
      assigneeId: emp1.id,
      projectId: p2.id,
      briefId: brief2.id,
      deadline: new Date(Date.now() + 86400000 * 14),
    },
  ]

  for (const task of taskDefs) {
    const deliverable = await prisma.deliverable.upsert({
      where: { id: `deliverable-${task.id}` },
      update: {},
      create: {
        id: `deliverable-${task.id}`,
        companyId: company.id,
        campaignId: task.projectId,
        briefId: task.briefId,
        title: task.title,
        description: `${task.title} deliverable scope`,
        type: task.id === 't-3' ? 'COPY' : 'GENERAL',
        status: task.stage === 'DONE' ? 'APPROVED' : task.stage === 'REVIEW' ? 'INTERNAL_REVIEW' : 'INTERNAL_REVIEW',
        approvalState: task.stage === 'DONE' ? 'APPROVED' : 'PENDING',
        revisionCount: task.stage === 'DONE' ? 1 : 0,
        dueAt: task.deadline,
        deliveredAt: task.stage === 'DONE' ? new Date() : null,
      },
    })

    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: {
        id: task.id,
        title: task.title,
        priority: task.priority,
        stage: task.stage,
        progress: task.progress,
        assigneeId: task.assigneeId,
        projectId: task.projectId,
        deliverableId: deliverable.id,
        deadline: task.deadline,
        description: `${task.title} - detailed implementation task`,
      },
    })
    await prisma.activity.create({
      data: {
        taskId: task.id,
        userId: task.assigneeId,
        action: task.stage === 'DONE' ? 'Task completed' : 'Task created',
      },
    })
  }

  console.log('Seed complete!\n')
  console.log('Demo accounts (password: password123):')
  console.log('  Owner:    owner@taskforce.com')
  console.log('  Manager:  manager@taskforce.com')
  console.log('  Employee: emp1@taskforce.com')
  console.log('  Employee: emp2@taskforce.com')
  if (superAdminEmail) {
    console.log(`  Super Admin: ${superAdminEmail.toLowerCase()}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
