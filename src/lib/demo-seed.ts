/**
 * Demo seed logic — shared between the CLI script (prisma/seed-demo.ts)
 * and the production API route (POST /api/admin/seed-demo).
 *
 * All IDs are prefixed with "demo-" and companies are tagged with
 * metadata._demo so the reset function can find and delete them cleanly.
 */

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export const DEMO_PASSWORD = 'Demo@2026!'
export const DEMO_TAG = 'demo-seed-v1'
export const DEMO_BCRYPT_ROUNDS = 12

function daysAgo(n: number) { return new Date(Date.now() - n * 86_400_000) }
function daysFromNow(n: number) { return new Date(Date.now() + n * 86_400_000) }
function hoursAgo(n: number) { return new Date(Date.now() - n * 3_600_000) }
function uid(prefix: string, slug: string) { return `demo-${prefix}-${slug}` }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TaskDef = {
  id: string
  title: string
  priority: string
  stage: string
  progress: number
  assigneeId: string
  projectId: string
  deliverableId: string
  deadline: Date
  description?: string
}

type InvoiceItemDef = { description: string; quantity: number; unitPrice: number }

type InvoiceDef = {
  id: string
  companyId: string
  createdById: string
  clientId: string
  invoiceNumber: string
  clientName: string
  clientEmail: string
  status: string
  currency: string
  issueDate: Date
  dueDate: Date
  paidAt?: Date
  sentAt?: Date
  subtotal: number
  taxRate: number
  items: InvoiceItemDef[]
}

type ContractDef = {
  id: string
  companyId: string
  clientId: string
  projectId: string
  createdById: string
  contractNumber: string
  title: string
  type: string
  status: string
  effectiveDate: Date
  expiryDate: Date
  signedAt?: Date
  sentAt?: Date
  currency: string
}

type CalEventDef = {
  id: string
  title: string
  type: string
  projectId?: string
  startsAt: Date
  endsAt?: Date
  color?: string
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function upsertTask(t: TaskDef) {
  await prisma.task.upsert({
    where: { id: t.id },
    update: {},
    create: {
      id: t.id,
      title: t.title,
      description: t.description ?? `${t.title} — see brief for full scope and acceptance criteria.`,
      priority: t.priority,
      stage: t.stage,
      progress: t.progress,
      assigneeId: t.assigneeId,
      projectId: t.projectId,
      deliverableId: t.deliverableId,
      deadline: t.deadline,
    },
  })
  await prisma.activity.create({
    data: {
      entityType: 'task',
      entityId: t.id,
      userId: t.assigneeId,
      action: t.stage === 'DONE' ? `Completed task: ${t.title}` : `Task created: ${t.title}`,
      createdAt: t.stage === 'DONE' ? t.deadline : new Date(t.deadline.getTime() - 5 * 86_400_000),
    },
  })
}

async function upsertInvoice(inv: InvoiceDef) {
  const taxTotal = (inv.subtotal * inv.taxRate) / 100
  const total = inv.subtotal + taxTotal

  const invoice = await prisma.invoice.upsert({
    where: { companyId_invoiceNumber: { companyId: inv.companyId, invoiceNumber: inv.invoiceNumber } },
    update: {},
    create: {
      id: inv.id,
      companyId: inv.companyId,
      createdById: inv.createdById,
      clientId: inv.clientId,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientName,
      clientEmail: inv.clientEmail,
      status: inv.status,
      currency: inv.currency,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      sentAt: inv.sentAt,
      taxRate: inv.taxRate,
      subtotal: inv.subtotal,
      taxTotal,
      total,
    },
  })

  for (const item of inv.items) {
    const itemId = uid('invitem', `${inv.id}-${Buffer.from(item.description).toString('base64').slice(0, 16)}`)
    await prisma.invoiceItem.upsert({
      where: { id: itemId },
      update: {},
      create: {
        id: itemId,
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      },
    })
  }
}

async function upsertContract(c: ContractDef) {
  const contract = await prisma.contract.upsert({
    where: { companyId_contractNumber: { companyId: c.companyId, contractNumber: c.contractNumber } },
    update: {},
    create: {
      id: c.id,
      companyId: c.companyId,
      clientId: c.clientId,
      projectId: c.projectId,
      createdById: c.createdById,
      contractNumber: c.contractNumber,
      title: c.title,
      type: c.type,
      status: c.status,
      currency: c.currency,
      effectiveDate: c.effectiveDate,
      expiryDate: c.expiryDate,
      signedAt: c.signedAt,
      sentAt: c.sentAt,
      approvedAt: c.signedAt ? new Date(c.signedAt.getTime() - 86_400_000) : undefined,
    },
  })

  await prisma.contractVersion.upsert({
    where: { contractId_versionNumber: { contractId: contract.id, versionNumber: 1 } },
    update: {},
    create: {
      id: uid('conver', `${c.id}-v1`),
      companyId: c.companyId,
      contractId: contract.id,
      createdById: c.createdById,
      versionNumber: 1,
      status: c.status === 'signed' ? 'signed' : 'generated',
      title: `${c.title} v1`,
      content: {
        sections: [
          { heading: 'Parties', body: 'This agreement is between the client and the service provider as named above.' },
          { heading: 'Scope of Services', body: 'Services to be delivered as outlined in the project brief and associated schedule of work.' },
          { heading: 'Payment Terms', body: `All invoices payable in ${c.currency} within 30 days of issue.` },
          { heading: 'Effective Date', body: c.effectiveDate.toISOString().slice(0, 10) },
          { heading: 'Expiry', body: c.expiryDate.toISOString().slice(0, 10) },
          { heading: 'Governing Law', body: 'This agreement is governed by the laws of the jurisdiction of the service provider.' },
        ],
      },
    },
  })
}

async function upsertCalendarEvents(companyId: string, createdById: string, events: CalEventDef[]) {
  for (const ev of events) {
    await prisma.calendarEvent.upsert({
      where: { id: ev.id },
      update: {},
      create: {
        id: ev.id,
        companyId,
        createdById,
        title: ev.title,
        type: ev.type,
        projectId: ev.projectId,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        color: ev.color,
      },
    })
  }
}

async function seedActivities(companyId: string, items: { userId: string; action: string; daysBack: number }[]) {
  for (const item of items) {
    await prisma.activity.create({
      data: {
        companyId,
        entityType: 'workspace',
        userId: item.userId,
        action: item.action,
        createdAt: daysAgo(item.daysBack),
      },
    })
  }
}

async function seedAlerts(
  companyId: string,
  items: { senderId: string; recipientId: string; type: string; title: string; message: string; priority: string }[]
) {
  for (const item of items) {
    await prisma.alert.create({
      data: {
        companyId,
        senderId: item.senderId,
        recipientId: item.recipientId,
        type: item.type,
        title: item.title,
        message: item.message,
        priority: item.priority,
        read: false,
        channel: 'in_app',
        deliveryState: 'SENT',
        createdAt: hoursAgo(Math.floor(Math.random() * 48) + 1),
      },
    })
  }
}

// ---------------------------------------------------------------------------
// Workspace 1: Luminary Studio — Digital Agency (small)
// ---------------------------------------------------------------------------

async function seedLuminaryStudio(hashedPw: string) {
  const cid = uid('co', 'luminary')

  const owner = await prisma.user.upsert({
    where: { email: 'claire.martin@luminarystudio.io' },
    update: { password: hashedPw },
    create: { id: uid('u', 'luminary-owner'), name: 'Claire Martin', email: 'claire.martin@luminarystudio.io', password: hashedPw, role: 'OWNER', accountStatus: 'ACTIVE' },
  })

  const company = await prisma.company.upsert({
    where: { id: cid },
    update: { name: 'Luminary Studio' },
    create: {
      id: cid, name: 'Luminary Studio', ownerId: owner.id, emailDomain: 'luminarystudio.io',
      companyType: 'DIGITAL_AGENCY', country: 'United States', industry: 'Creative Agency',
      registrationNumber: 'LS-2024-0881', status: 'ACTIVE', subscriptionStatus: 'ACTIVE',
      planType: 'STARTER', seatCount: 8, metadata: { _demo: DEMO_TAG },
    },
  })

  await prisma.user.update({ where: { id: owner.id }, data: { companyId: company.id } })

  const makeUser = (slug: string, name: string, email: string, role: string) =>
    prisma.user.upsert({
      where: { email },
      update: { password: hashedPw },
      create: { id: uid('u', slug), name, email, password: hashedPw, role, accountStatus: 'ACTIVE', companyId: company.id },
    })

  const manager = await makeUser('luminary-mgr', 'James Okafor', 'james.okafor@luminarystudio.io', 'MANAGER')
  const emp1 = await makeUser('luminary-e1', 'Sofia Reyes', 'sofia.reyes@luminarystudio.io', 'EMPLOYEE')
  const emp2 = await makeUser('luminary-e2', 'Luca Ferrari', 'luca.ferrari@luminarystudio.io', 'EMPLOYEE')
  const emp3 = await makeUser('luminary-e3', 'Priya Nair', 'priya.nair@luminarystudio.io', 'EMPLOYEE')
  const emp4 = await makeUser('luminary-e4', 'Ethan Kowalski', 'ethan.kowalski@luminarystudio.io', 'EMPLOYEE')

  const makeClient = (slug: string, companyName: string, contactPerson: string, email: string, phone: string) =>
    prisma.client.upsert({
      where: { id: uid('cl', slug) },
      update: {},
      create: { id: uid('cl', slug), companyId: company.id, companyName, contactPerson, email, phone, country: 'United States', status: 'active' },
    })

  const client1 = await makeClient('luminary-verdant', 'Verdant Foods Co.', 'Rachel Bloom', 'rachel.bloom@verdantfoods.com', '+1-415-882-3301')
  const client2 = await makeClient('luminary-auros', 'Auros Capital', 'Thomas Wren', 'twren@auroscapital.com', '+1-212-554-0090')
  const client3 = await makeClient('luminary-nimbly', 'Nimbly Health', 'Dr. Amara Sow', 'amara.sow@nimblyhealth.com', '+1-628-710-4422')

  const makeCategory = (slug: string, name: string, description: string) =>
    prisma.projectCategory.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: {},
      create: { id: uid('cat', slug), companyId: company.id, name, description },
    })

  const catBrand = await makeCategory('luminary-brand', 'Brand Identity', 'Logos, brand guidelines, visual systems')
  const catSocial = await makeCategory('luminary-social', 'Social Media', 'Instagram, LinkedIn, and paid social campaigns')
  const catWeb = await makeCategory('luminary-web', 'Web and Digital', 'Landing pages, microsites, and digital experiences')

  const proj1 = await prisma.project.upsert({
    where: { id: uid('proj', 'luminary-verdant-rebrand') },
    update: {},
    create: { id: uid('proj', 'luminary-verdant-rebrand'), companyId: company.id, categoryId: catBrand.id, clientId: client1.id, clientName: client1.companyName, managerId: manager.id, title: 'Verdant Foods — Brand Refresh 2026', description: 'Full visual identity overhaul for Verdant Foods Q1 launch. Includes new logo system, packaging concepts, brand manual, and digital asset kit.' },
  })

  const proj2 = await prisma.project.upsert({
    where: { id: uid('proj', 'luminary-auros-social') },
    update: {},
    create: { id: uid('proj', 'luminary-auros-social'), companyId: company.id, categoryId: catSocial.id, clientId: client2.id, clientName: client2.companyName, managerId: manager.id, title: 'Auros Capital — Q2 LinkedIn Campaign', description: 'Six-week LinkedIn campaign targeting Series B founders. Includes thought leadership posts, carousel ads, and event promotion graphics.' },
  })

  const proj3 = await prisma.project.upsert({
    where: { id: uid('proj', 'luminary-nimbly-web') },
    update: {},
    create: { id: uid('proj', 'luminary-nimbly-web'), companyId: company.id, categoryId: catWeb.id, clientId: client3.id, clientName: client3.companyName, managerId: manager.id, title: 'Nimbly Health — Product Landing Page', description: 'High-converting landing page for the Nimbly telehealth subscription launch. Includes copy, wireframes, design, and dev handoff.' },
  })

  const makeBrief = (slug: string, campaignId: string, clientId: string | null, createdById: string, title: string, description: string, daysBack: number) =>
    prisma.brief.upsert({
      where: { id: uid('brief', slug) },
      update: {},
      create: { id: uid('brief', slug), companyId: company.id, campaignId, clientId: clientId ?? undefined, createdById, title, description, status: 'APPROVED', approvedAt: daysAgo(daysBack) },
    })

  const briefP1 = await makeBrief('luminary-verdant-b1', proj1.id, client1.id, manager.id, 'Visual Identity System', 'Deliver a complete visual identity system: primary logo, secondary marks, color palette, typography stack, and usage guidelines.', 40)
  const briefP1b = await makeBrief('luminary-verdant-b2', proj1.id, client1.id, manager.id, 'Packaging Design — Retail Range', 'Three SKU packaging designs for the retail product line. Must follow new brand guidelines and be print-production ready.', 20)
  const briefP2 = await makeBrief('luminary-auros-b1', proj2.id, client2.id, manager.id, 'Q2 LinkedIn Creative — Founders Series', 'Produce 12 LinkedIn posts, 4 carousel ads, and 2 event banners for the Founders Series thought leadership campaign.', 50)
  const briefP3 = await makeBrief('luminary-nimbly-b1', proj3.id, client3.id, manager.id, 'Landing Page — Full Build', 'Strategy, wireframes, high-fidelity design, and final dev-handoff assets for the Nimbly product launch landing page.', 8)

  const makeDeliverable = (slug: string, campaignId: string, briefId: string, title: string, description: string, type: string, status: string, approvalState: string, revisionCount: number, dueAt: Date, deliveredAt?: Date) =>
    prisma.deliverable.upsert({
      where: { id: uid('del', slug) },
      update: {},
      create: { id: uid('del', slug), companyId: company.id, campaignId, briefId, title, description, type, status, approvalState, revisionCount, dueAt, deliveredAt },
    })

  const dP1a = await makeDeliverable('luminary-logo', proj1.id, briefP1.id, 'Primary Logo Suite', 'Full logo lockups in horizontal, stacked, and icon-only — all required formats.', 'IMAGE', 'APPROVED', 'APPROVED', 2, daysAgo(10), daysAgo(8))
  const dP1b = await makeDeliverable('luminary-brandguide', proj1.id, briefP1.id, 'Brand Guidelines Document', '48-page brand manual covering voice, visual identity, and usage rules.', 'GENERAL', 'CLIENT_REVIEW', 'PENDING', 1, daysFromNow(5))
  const dP1c = await makeDeliverable('luminary-packaging', proj1.id, briefP1b.id, 'Packaging Mockups — 3 SKUs', 'Print-ready dielines with photorealistic mockups for all three SKUs.', 'IMAGE', 'INTERNAL_REVIEW', 'PENDING', 0, daysFromNow(14))
  const dP2a = await makeDeliverable('luminary-linkedin-posts', proj2.id, briefP2.id, 'LinkedIn Posts — Weeks 1-6 (12 posts)', 'Static graphics and copy for 12 weekly LinkedIn posts.', 'IMAGE', 'APPROVED', 'APPROVED', 1, daysAgo(25), daysAgo(22))
  const dP2b = await makeDeliverable('luminary-carousel-ads', proj2.id, briefP2.id, 'Carousel Ads — 4 Variants', 'Four 5-slide carousel ads targeting different founder segments.', 'IMAGE', 'APPROVED', 'APPROVED', 0, daysAgo(15), daysAgo(13))
  const dP3a = await makeDeliverable('luminary-nimbly-wire', proj3.id, briefP3.id, 'Wireframes — Desktop and Mobile', 'Low-fidelity wireframes for all page sections across breakpoints.', 'GENERAL', 'INTERNAL_REVIEW', 'PENDING', 0, daysFromNow(3))
  const dP3b = await makeDeliverable('luminary-nimbly-design', proj3.id, briefP3.id, 'High-Fidelity Design — All Sections', 'Full Figma file with interactive prototype and design tokens.', 'GENERAL', 'INTERNAL_REVIEW', 'PENDING', 0, daysFromNow(18))

  const tasks: TaskDef[] = [
    { id: uid('task', 'lum-t1'), title: 'Finalise primary logo — client sign-off', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: emp1.id, projectId: proj1.id, deliverableId: dP1a.id, deadline: daysAgo(10) },
    { id: uid('task', 'lum-t2'), title: 'Brand guidelines — layout and copy pass', priority: 'HIGH', stage: 'IN_PROGRESS', progress: 65, assigneeId: emp1.id, projectId: proj1.id, deliverableId: dP1b.id, deadline: daysFromNow(5) },
    { id: uid('task', 'lum-t3'), title: 'Packaging dielines — SKU-1 draft', priority: 'MEDIUM', stage: 'IN_PROGRESS', progress: 30, assigneeId: emp2.id, projectId: proj1.id, deliverableId: dP1c.id, deadline: daysFromNow(10) },
    { id: uid('task', 'lum-t4'), title: 'Packaging dielines — SKU-2 and SKU-3 draft', priority: 'MEDIUM', stage: 'TODO', progress: 0, assigneeId: emp2.id, projectId: proj1.id, deliverableId: dP1c.id, deadline: daysFromNow(14) },
    { id: uid('task', 'lum-t5'), title: 'LinkedIn posts — all 12 designed and approved', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: emp3.id, projectId: proj2.id, deliverableId: dP2a.id, deadline: daysAgo(22) },
    { id: uid('task', 'lum-t6'), title: 'Carousel ads — final export and upload', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: emp3.id, projectId: proj2.id, deliverableId: dP2b.id, deadline: daysAgo(13) },
    { id: uid('task', 'lum-t7'), title: 'Wireframes — section mapping and layout', priority: 'HIGH', stage: 'IN_PROGRESS', progress: 50, assigneeId: emp4.id, projectId: proj3.id, deliverableId: dP3a.id, deadline: daysFromNow(3) },
    { id: uid('task', 'lum-t8'), title: 'High-fidelity design — hero section', priority: 'MEDIUM', stage: 'TODO', progress: 0, assigneeId: emp4.id, projectId: proj3.id, deliverableId: dP3b.id, deadline: daysFromNow(18) },
  ]
  for (const t of tasks) await upsertTask(t)

  await upsertInvoice({ id: uid('inv', 'lum-001'), companyId: company.id, createdById: manager.id, clientId: client1.id, invoiceNumber: 'INV-2026-001', clientName: 'Verdant Foods Co.', clientEmail: 'rachel.bloom@verdantfoods.com', status: 'paid', currency: 'USD', issueDate: daysAgo(55), dueDate: daysAgo(25), paidAt: daysAgo(20), sentAt: daysAgo(55), subtotal: 8500, taxRate: 8.5, items: [{ description: 'Brand strategy and discovery workshop', quantity: 1, unitPrice: 2500 }, { description: 'Visual identity design Phase 1', quantity: 1, unitPrice: 6000 }] })
  await upsertInvoice({ id: uid('inv', 'lum-002'), companyId: company.id, createdById: manager.id, clientId: client2.id, invoiceNumber: 'INV-2026-002', clientName: 'Auros Capital', clientEmail: 'twren@auroscapital.com', status: 'paid', currency: 'USD', issueDate: daysAgo(30), dueDate: daysAgo(15), paidAt: daysAgo(12), sentAt: daysAgo(30), subtotal: 12000, taxRate: 8.5, items: [{ description: 'LinkedIn campaign creative — 12 posts', quantity: 1, unitPrice: 6000 }, { description: 'Carousel ad design — 4 variants', quantity: 1, unitPrice: 4000 }, { description: 'Campaign strategy and content calendar', quantity: 1, unitPrice: 2000 }] })
  await upsertInvoice({ id: uid('inv', 'lum-003'), companyId: company.id, createdById: manager.id, clientId: client3.id, invoiceNumber: 'INV-2026-003', clientName: 'Nimbly Health', clientEmail: 'amara.sow@nimblyhealth.com', status: 'sent', currency: 'USD', issueDate: daysAgo(5), dueDate: daysFromNow(25), sentAt: daysAgo(5), subtotal: 15000, taxRate: 8.5, items: [{ description: 'Discovery and UX strategy', quantity: 1, unitPrice: 3000 }, { description: 'Wireframing and information architecture', quantity: 1, unitPrice: 4000 }, { description: 'High-fidelity UI design and prototype', quantity: 1, unitPrice: 6000 }, { description: 'Developer handoff and design system', quantity: 1, unitPrice: 2000 }] })
  await upsertInvoice({ id: uid('inv', 'lum-004'), companyId: company.id, createdById: manager.id, clientId: client1.id, invoiceNumber: 'INV-2026-004', clientName: 'Verdant Foods Co.', clientEmail: 'rachel.bloom@verdantfoods.com', status: 'draft', currency: 'USD', issueDate: daysAgo(2), dueDate: daysFromNow(28), subtotal: 9500, taxRate: 8.5, items: [{ description: 'Brand guidelines document production', quantity: 1, unitPrice: 4500 }, { description: 'Packaging design 3 SKU dielines and mockups', quantity: 1, unitPrice: 5000 }] })

  await upsertContract({ id: uid('con', 'lum-c001'), companyId: company.id, clientId: client1.id, projectId: proj1.id, createdById: owner.id, contractNumber: 'CON-2026-001', title: 'Brand Refresh Services Agreement — Verdant Foods Co.', type: 'SERVICE_AGREEMENT', status: 'signed', effectiveDate: daysAgo(60), expiryDate: daysFromNow(90), signedAt: daysAgo(58), currency: 'USD' })
  await upsertContract({ id: uid('con', 'lum-c002'), companyId: company.id, clientId: client2.id, projectId: proj2.id, createdById: owner.id, contractNumber: 'CON-2026-002', title: 'Q2 Campaign Services Agreement — Auros Capital', type: 'SERVICE_AGREEMENT', status: 'signed', effectiveDate: daysAgo(55), expiryDate: daysAgo(5), signedAt: daysAgo(52), currency: 'USD' })
  await upsertContract({ id: uid('con', 'lum-c003'), companyId: company.id, clientId: client3.id, projectId: proj3.id, createdById: owner.id, contractNumber: 'CON-2026-003', title: 'Landing Page Design Services — Nimbly Health', type: 'SERVICE_AGREEMENT', status: 'sent', effectiveDate: daysFromNow(1), expiryDate: daysFromNow(120), sentAt: daysAgo(4), currency: 'USD' })

  await upsertCalendarEvents(company.id, manager.id, [
    { id: uid('cal', 'lum-kickoff'), title: 'Verdant Foods — Brand Kickoff', type: 'PROJECT_EVENT', projectId: proj1.id, startsAt: daysAgo(60), endsAt: new Date(daysAgo(60).getTime() + 2 * 3600000), color: '#22c55e' },
    { id: uid('cal', 'lum-brandreview'), title: 'Brand Guidelines — Internal Review', type: 'MEETING', projectId: proj1.id, startsAt: daysFromNow(2), endsAt: new Date(daysFromNow(2).getTime() + 5400000), color: '#3b82f6' },
    { id: uid('cal', 'lum-pkg-milestone'), title: 'Packaging Draft Delivery Milestone', type: 'MILESTONE', projectId: proj1.id, startsAt: daysFromNow(14), color: '#f59e0b' },
    { id: uid('cal', 'lum-nimbly-kick'), title: 'Nimbly Health — Project Kickoff Call', type: 'MEETING', projectId: proj3.id, startsAt: daysAgo(8), endsAt: new Date(daysAgo(8).getTime() + 3600000), color: '#8b5cf6' },
    { id: uid('cal', 'lum-wire-review'), title: 'Nimbly — Wireframe Walkthrough', type: 'MEETING', projectId: proj3.id, startsAt: daysFromNow(4), endsAt: new Date(daysFromNow(4).getTime() + 3600000), color: '#8b5cf6' },
  ])

  await seedActivities(company.id, [
    { userId: manager.id, action: 'Campaign created: Verdant Foods Brand Refresh 2026', daysBack: 62 },
    { userId: emp1.id, action: 'Deliverable submitted: Primary Logo Suite Round 1', daysBack: 45 },
    { userId: manager.id, action: 'Client feedback received — logo revision requested', daysBack: 38 },
    { userId: emp1.id, action: 'Deliverable approved: Primary Logo Suite', daysBack: 8 },
    { userId: emp2.id, action: 'Task started: Packaging dielines SKU-1 draft', daysBack: 3 },
    { userId: manager.id, action: 'Invoice INV-2026-003 sent to Nimbly Health', daysBack: 5 },
    { userId: emp4.id, action: 'Task started: Wireframes section mapping and layout', daysBack: 2 },
    { userId: emp3.id, action: 'Campaign completed: Auros Capital Q2 LinkedIn Campaign', daysBack: 13 },
    { userId: owner.id, action: 'Contract signed: CON-2026-001 Verdant Foods', daysBack: 58 },
  ])

  await seedAlerts(company.id, [
    { senderId: manager.id, recipientId: emp4.id, type: 'DEADLINE_WARNING', title: 'Wireframes due in 3 days', message: 'Nimbly Health wireframes are due Thursday. Please update progress before EOD tomorrow.', priority: 'HIGH' },
    { senderId: owner.id, recipientId: manager.id, type: 'URGENT_TASK', title: 'Packaging draft needed for client preview', message: 'Verdant Foods requested an early preview of SKU-1 packaging. Please expedite.', priority: 'HIGH' },
  ])

  return company.id
}

// ---------------------------------------------------------------------------
// Workspace 2: Northbridge Group — Enterprise Operations (growing)
// ---------------------------------------------------------------------------

async function seedNorthbridgeGroup(hashedPw: string) {
  const cid = uid('co', 'northbridge')

  const owner = await prisma.user.upsert({
    where: { email: 'david.osei@northbridgegroup.com' },
    update: { password: hashedPw },
    create: { id: uid('u', 'nb-owner'), name: 'David Osei', email: 'david.osei@northbridgegroup.com', password: hashedPw, role: 'OWNER', accountStatus: 'ACTIVE' },
  })

  const company = await prisma.company.upsert({
    where: { id: cid },
    update: { name: 'Northbridge Group' },
    create: {
      id: cid, name: 'Northbridge Group', ownerId: owner.id, emailDomain: 'northbridgegroup.com',
      companyType: 'ENTERPRISE_OPERATIONS', country: 'United Kingdom', industry: 'Business Consulting',
      registrationNumber: 'NB-2023-0042', status: 'ACTIVE', subscriptionStatus: 'ACTIVE',
      planType: 'STARTER', seatCount: 16, metadata: { _demo: DEMO_TAG },
    },
  })

  await prisma.user.update({ where: { id: owner.id }, data: { companyId: company.id } })

  const teamSpec = [
    { slug: 'nb-mgr1', name: 'Hannah Prescott', email: 'h.prescott@northbridgegroup.com', role: 'MANAGER' },
    { slug: 'nb-mgr2', name: 'Marcus Webb', email: 'm.webb@northbridgegroup.com', role: 'MANAGER' },
    { slug: 'nb-e1', name: 'Amelia Thornton', email: 'a.thornton@northbridgegroup.com', role: 'EMPLOYEE' },
    { slug: 'nb-e2', name: 'Oliver Reid', email: 'o.reid@northbridgegroup.com', role: 'EMPLOYEE' },
    { slug: 'nb-e3', name: 'Charlotte Patel', email: 'c.patel@northbridgegroup.com', role: 'EMPLOYEE' },
    { slug: 'nb-e4', name: 'Benjamin Cross', email: 'b.cross@northbridgegroup.com', role: 'EMPLOYEE' },
    { slug: 'nb-e5', name: 'Isabelle Laurent', email: 'i.laurent@northbridgegroup.com', role: 'EMPLOYEE' },
    { slug: 'nb-e6', name: 'Noah Chambers', email: 'n.chambers@northbridgegroup.com', role: 'EMPLOYEE' },
    { slug: 'nb-e7', name: 'Grace Yuen', email: 'g.yuen@northbridgegroup.com', role: 'EMPLOYEE' },
    { slug: 'nb-e8', name: 'Samuel Adeyemi', email: 's.adeyemi@northbridgegroup.com', role: 'EMPLOYEE' },
  ]

  const nbUsers: Record<string, string> = {}
  for (const u of teamSpec) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { password: hashedPw },
      create: { id: uid('u', u.slug), name: u.name, email: u.email, password: hashedPw, role: u.role, accountStatus: 'ACTIVE', companyId: company.id },
    })
    nbUsers[u.slug] = user.id
  }

  const mgr1Id = nbUsers['nb-mgr1']
  const mgr2Id = nbUsers['nb-mgr2']

  const roomOps = await prisma.room.upsert({ where: { id: uid('room', 'nb-ops') }, update: {}, create: { id: uid('room', 'nb-ops'), companyId: company.id, name: 'Operations', description: 'Core operational delivery' } })
  const roomIT = await prisma.room.upsert({ where: { id: uid('room', 'nb-it') }, update: {}, create: { id: uid('room', 'nb-it'), companyId: company.id, name: 'Technology', description: 'IT and digital transformation' } })
  const roomHR = await prisma.room.upsert({ where: { id: uid('room', 'nb-hr') }, update: {}, create: { id: uid('room', 'nb-hr'), companyId: company.id, name: 'People and Culture', description: 'HR and employee experience' } })

  const deptOps = await prisma.enterpriseDepartment.upsert({ where: { companyId_code: { companyId: company.id, code: 'OPS' } }, update: {}, create: { id: uid('dept', 'nb-ops'), companyId: company.id, name: 'Operations', code: 'OPS', managerId: mgr1Id, status: 'ACTIVE' } })
  const deptIT = await prisma.enterpriseDepartment.upsert({ where: { companyId_code: { companyId: company.id, code: 'TECH' } }, update: {}, create: { id: uid('dept', 'nb-tech'), companyId: company.id, name: 'Technology', code: 'TECH', managerId: mgr2Id, status: 'ACTIVE' } })
  await prisma.enterpriseDepartment.upsert({ where: { companyId_code: { companyId: company.id, code: 'HR' } }, update: {}, create: { id: uid('dept', 'nb-hr'), companyId: company.id, name: 'People and Culture', code: 'HR', managerId: mgr1Id, status: 'ACTIVE' } })

  await prisma.enterpriseTeam.upsert({ where: { companyId_code: { companyId: company.id, code: 'DELIVERY' } }, update: {}, create: { id: uid('team', 'nb-delivery'), companyId: company.id, departmentId: deptOps.id, leaderId: mgr1Id, name: 'Client Delivery', code: 'DELIVERY', queueKey: 'nb-delivery-queue', status: 'ACTIVE' } })
  await prisma.enterpriseTeam.upsert({ where: { companyId_code: { companyId: company.id, code: 'INFRA' } }, update: {}, create: { id: uid('team', 'nb-infra'), companyId: company.id, departmentId: deptIT.id, leaderId: mgr2Id, name: 'Infrastructure and Systems', code: 'INFRA', queueKey: 'nb-infra-queue', status: 'ACTIVE' } })

  const nbC1 = await prisma.client.upsert({ where: { id: uid('cl', 'nb-penrose') }, update: {}, create: { id: uid('cl', 'nb-penrose'), companyId: company.id, companyName: 'Penrose Logistics', contactPerson: 'Greg Halloran', email: 'g.halloran@penroselogistics.co.uk', phone: '+44-20-7946-0212', country: 'United Kingdom', status: 'active' } })
  const nbC2 = await prisma.client.upsert({ where: { id: uid('cl', 'nb-alto') }, update: {}, create: { id: uid('cl', 'nb-alto'), companyId: company.id, companyName: 'Alto Financial Services', contactPerson: 'Jennifer Holt', email: 'jennifer.holt@altofinancial.co.uk', phone: '+44-20-3398-8851', country: 'United Kingdom', status: 'active' } })
  const nbC3 = await prisma.client.upsert({ where: { id: uid('cl', 'nb-sable') }, update: {}, create: { id: uid('cl', 'nb-sable'), companyId: company.id, companyName: 'Sable Retail Group', contactPerson: 'Patrick Adkins', email: 'padkins@sableretail.co.uk', phone: '+44-113-496-7733', country: 'United Kingdom', status: 'active' } })

  const nbP1 = await prisma.project.upsert({ where: { id: uid('proj', 'nb-penrose-ops') }, update: {}, create: { id: uid('proj', 'nb-penrose-ops'), companyId: company.id, roomId: roomOps.id, clientId: nbC1.id, clientName: nbC1.companyName, managerId: mgr1Id, title: 'Penrose Logistics — Operational Efficiency Review', description: 'A 12-week engagement to audit warehouse routing, carrier contracts, and dispatch workflows.' } })
  const nbP2 = await prisma.project.upsert({ where: { id: uid('proj', 'nb-alto-digital') }, update: {}, create: { id: uid('proj', 'nb-alto-digital'), companyId: company.id, roomId: roomIT.id, clientId: nbC2.id, clientName: nbC2.companyName, managerId: mgr2Id, title: 'Alto Financial — Digital Transformation Roadmap', description: 'Develop a 3-year technology roadmap for the core banking migration, API strategy, and digital channel expansion.' } })
  const nbP3 = await prisma.project.upsert({ where: { id: uid('proj', 'nb-internal-hrtech') }, update: {}, create: { id: uid('proj', 'nb-internal-hrtech'), companyId: company.id, roomId: roomHR.id, managerId: mgr1Id, title: 'Internal — HR Technology Implementation', description: 'Implementation of a new HRIS and performance management platform.' } })

  const makeBrief = (slug: string, campaignId: string, clientId: string | null, createdById: string, title: string, description: string, daysBack: number) =>
    prisma.brief.upsert({ where: { id: uid('brief', slug) }, update: {}, create: { id: uid('brief', slug), companyId: company.id, campaignId, clientId: clientId ?? undefined, createdById, title, description, status: 'APPROVED', approvedAt: daysAgo(daysBack) } })

  const nbBr1a = await makeBrief('nb-penrose-gap', nbP1.id, nbC1.id, mgr1Id, 'Gap Analysis and Process Audit', 'Audit current state of warehouse routing, carrier contracts, and dispatch workflows.', 70)
  const nbBr1b = await makeBrief('nb-penrose-sop', nbP1.id, nbC1.id, mgr1Id, 'SOP Redesign and Savings Model', 'Redesign dispatch and routing SOPs based on audit findings. Build a financial savings model projecting 18-month impact.', 40)
  const nbBr2a = await makeBrief('nb-alto-arch', nbP2.id, nbC2.id, mgr2Id, 'Architecture and Vendor Assessment', 'Assess current core banking architecture and evaluate 4 shortlisted vendors against requirements.', 25)
  const nbBr3a = await makeBrief('nb-hr-req', nbP3.id, null, mgr1Id, 'HRIS Requirements and Vendor Selection', 'Gather requirements from all department heads and produce a vendor shortlist with recommendation.', 15)

  const makeDel = (slug: string, campaignId: string, briefId: string, title: string, description: string, status: string, approvalState: string, revisionCount: number, dueAt: Date, deliveredAt?: Date) =>
    prisma.deliverable.upsert({ where: { id: uid('del', slug) }, update: {}, create: { id: uid('del', slug), companyId: company.id, campaignId, briefId, title, description, type: 'GENERAL', status, approvalState, revisionCount, dueAt, deliveredAt } })

  const nbD1a = await makeDel('nb-penrose-audit', nbP1.id, nbBr1a.id, 'Operational Audit Report', '40-page audit report covering warehouse routing, carrier contracts, and KPI benchmarks.', 'APPROVED', 'APPROVED', 1, daysAgo(35), daysAgo(33))
  const nbD1b = await makeDel('nb-penrose-sop', nbP1.id, nbBr1b.id, 'Revised SOP Documentation', 'Complete rewrite of 6 core dispatch and routing SOPs.', 'CLIENT_REVIEW', 'PENDING', 0, daysFromNow(7))
  const nbD1c = await makeDel('nb-penrose-savings', nbP1.id, nbBr1b.id, 'Savings Opportunity Model', 'Financial model projecting cost savings from SOP changes over 18 months.', 'INTERNAL_REVIEW', 'PENDING', 0, daysFromNow(12))
  const nbD2a = await makeDel('nb-alto-vendor', nbP2.id, nbBr2a.id, 'Vendor Assessment Matrix', 'Scored matrix comparing 4 core banking vendors against 38 weighted criteria.', 'INTERNAL_REVIEW', 'PENDING', 0, daysFromNow(10))
  const nbD3a = await makeDel('nb-hr-requirements', nbP3.id, nbBr3a.id, 'HRIS Requirements Document', 'Consolidated requirements from 6 department stakeholders, categorised by priority.', 'INTERNAL_REVIEW', 'PENDING', 0, daysFromNow(5))

  const nbTasks: TaskDef[] = [
    { id: uid('task', 'nb-t1'), title: 'Carrier contract analysis — shortlist high-cost routes', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: nbUsers['nb-e1'], projectId: nbP1.id, deliverableId: nbD1a.id, deadline: daysAgo(40) },
    { id: uid('task', 'nb-t2'), title: 'Warehouse routing interviews — site 1 and site 2', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: nbUsers['nb-e2'], projectId: nbP1.id, deliverableId: nbD1a.id, deadline: daysAgo(38) },
    { id: uid('task', 'nb-t3'), title: 'Draft gap analysis report — sections 1 through 4', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: nbUsers['nb-e1'], projectId: nbP1.id, deliverableId: nbD1a.id, deadline: daysAgo(35) },
    { id: uid('task', 'nb-t4'), title: 'Rewrite dispatch SOP — inbound routing', priority: 'HIGH', stage: 'IN_PROGRESS', progress: 70, assigneeId: nbUsers['nb-e3'], projectId: nbP1.id, deliverableId: nbD1b.id, deadline: daysFromNow(5) },
    { id: uid('task', 'nb-t5'), title: 'Rewrite dispatch SOP — outbound carrier selection', priority: 'HIGH', stage: 'IN_PROGRESS', progress: 40, assigneeId: nbUsers['nb-e3'], projectId: nbP1.id, deliverableId: nbD1b.id, deadline: daysFromNow(7) },
    { id: uid('task', 'nb-t6'), title: 'Build savings model — baseline data', priority: 'MEDIUM', stage: 'IN_PROGRESS', progress: 25, assigneeId: nbUsers['nb-e4'], projectId: nbP1.id, deliverableId: nbD1c.id, deadline: daysFromNow(10) },
    { id: uid('task', 'nb-t7'), title: 'Vendor assessment — requirements workshop with client', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: nbUsers['nb-e5'], projectId: nbP2.id, deliverableId: nbD2a.id, deadline: daysAgo(20) },
    { id: uid('task', 'nb-t8'), title: 'Score vendor RFP responses against criteria', priority: 'HIGH', stage: 'IN_PROGRESS', progress: 55, assigneeId: nbUsers['nb-e5'], projectId: nbP2.id, deliverableId: nbD2a.id, deadline: daysFromNow(8) },
    { id: uid('task', 'nb-t9'), title: 'Compile vendor assessment matrix draft', priority: 'MEDIUM', stage: 'TODO', progress: 0, assigneeId: nbUsers['nb-e6'], projectId: nbP2.id, deliverableId: nbD2a.id, deadline: daysFromNow(12) },
    { id: uid('task', 'nb-t10'), title: 'Stakeholder interviews — HR requirements gathering', priority: 'HIGH', stage: 'IN_PROGRESS', progress: 60, assigneeId: nbUsers['nb-e7'], projectId: nbP3.id, deliverableId: nbD3a.id, deadline: daysFromNow(3) },
    { id: uid('task', 'nb-t11'), title: 'Document HRIS requirements — people and payroll modules', priority: 'MEDIUM', stage: 'TODO', progress: 0, assigneeId: nbUsers['nb-e8'], projectId: nbP3.id, deliverableId: nbD3a.id, deadline: daysFromNow(6) },
  ]
  for (const t of nbTasks) await upsertTask(t)

  await upsertInvoice({ id: uid('inv', 'nb-001'), companyId: company.id, createdById: owner.id, clientId: nbC1.id, invoiceNumber: 'NBI-2026-001', clientName: 'Penrose Logistics', clientEmail: 'g.halloran@penroselogistics.co.uk', status: 'paid', currency: 'GBP', issueDate: daysAgo(80), dueDate: daysAgo(50), paidAt: daysAgo(48), sentAt: daysAgo(80), subtotal: 28000, taxRate: 20, items: [{ description: 'Phase 1 operational audit and gap analysis', quantity: 1, unitPrice: 28000 }] })
  await upsertInvoice({ id: uid('inv', 'nb-002'), companyId: company.id, createdById: owner.id, clientId: nbC1.id, invoiceNumber: 'NBI-2026-002', clientName: 'Penrose Logistics', clientEmail: 'g.halloran@penroselogistics.co.uk', status: 'sent', currency: 'GBP', issueDate: daysAgo(10), dueDate: daysFromNow(20), sentAt: daysAgo(10), subtotal: 22000, taxRate: 20, items: [{ description: 'Phase 2 SOP redesign and savings model', quantity: 1, unitPrice: 22000 }] })
  await upsertInvoice({ id: uid('inv', 'nb-003'), companyId: company.id, createdById: owner.id, clientId: nbC2.id, invoiceNumber: 'NBI-2026-003', clientName: 'Alto Financial Services', clientEmail: 'jennifer.holt@altofinancial.co.uk', status: 'paid', currency: 'GBP', issueDate: daysAgo(30), dueDate: daysAgo(15), paidAt: daysAgo(14), sentAt: daysAgo(30), subtotal: 18500, taxRate: 20, items: [{ description: 'Digital transformation discovery phase', quantity: 1, unitPrice: 12000 }, { description: 'Vendor requirements workshop 2 days', quantity: 1, unitPrice: 6500 }] })
  await upsertInvoice({ id: uid('inv', 'nb-004'), companyId: company.id, createdById: owner.id, clientId: nbC3.id, invoiceNumber: 'NBI-2026-004', clientName: 'Sable Retail Group', clientEmail: 'padkins@sableretail.co.uk', status: 'overdue', currency: 'GBP', issueDate: daysAgo(45), dueDate: daysAgo(15), sentAt: daysAgo(45), subtotal: 9500, taxRate: 20, items: [{ description: 'Retail operations assessment initial discovery', quantity: 1, unitPrice: 9500 }] })

  await upsertContract({ id: uid('con', 'nb-c001'), companyId: company.id, clientId: nbC1.id, projectId: nbP1.id, createdById: owner.id, contractNumber: 'NB-CON-2026-001', title: 'Operational Efficiency Consulting Agreement — Penrose Logistics', type: 'SERVICE_AGREEMENT', status: 'signed', effectiveDate: daysAgo(85), expiryDate: daysFromNow(5), signedAt: daysAgo(82), currency: 'GBP' })
  await upsertContract({ id: uid('con', 'nb-c002'), companyId: company.id, clientId: nbC2.id, projectId: nbP2.id, createdById: owner.id, contractNumber: 'NB-CON-2026-002', title: 'Digital Transformation Advisory — Alto Financial Services', type: 'SERVICE_AGREEMENT', status: 'signed', effectiveDate: daysAgo(35), expiryDate: daysFromNow(55), signedAt: daysAgo(33), currency: 'GBP' })

  await upsertCalendarEvents(company.id, mgr1Id, [
    { id: uid('cal', 'nb-penrose-kick'), title: 'Penrose Logistics — Engagement Kickoff', type: 'PROJECT_EVENT', projectId: nbP1.id, startsAt: daysAgo(85), endsAt: new Date(daysAgo(85).getTime() + 3 * 3600000), color: '#0ea5e9' },
    { id: uid('cal', 'nb-penrose-sop-review'), title: 'Penrose — SOP Review with Operations Team', type: 'MEETING', projectId: nbP1.id, startsAt: daysFromNow(6), endsAt: new Date(daysFromNow(6).getTime() + 2 * 3600000), color: '#0ea5e9' },
    { id: uid('cal', 'nb-alto-workshop'), title: 'Alto Financial — Discovery Workshop Day 1', type: 'MEETING', projectId: nbP2.id, startsAt: daysAgo(32), endsAt: new Date(daysAgo(32).getTime() + 8 * 3600000), color: '#f97316' },
    { id: uid('cal', 'nb-alto-vendor-pres'), title: 'Alto — Vendor Scorecard Presentation', type: 'MILESTONE', projectId: nbP2.id, startsAt: daysFromNow(14), color: '#f97316' },
    { id: uid('cal', 'nb-qbr'), title: 'Q2 2026 Business Review — Leadership', type: 'MEETING', startsAt: daysFromNow(20), endsAt: new Date(daysFromNow(20).getTime() + 3 * 3600000), color: '#8b5cf6' },
  ])

  await seedActivities(company.id, [
    { userId: mgr1Id, action: 'Engagement started: Penrose Logistics Operational Efficiency Review', daysBack: 85 },
    { userId: nbUsers['nb-e1'], action: 'Audit interviews completed — 14 stakeholders across 2 sites', daysBack: 42 },
    { userId: mgr1Id, action: 'Operational Audit Report delivered and approved by client', daysBack: 33 },
    { userId: nbUsers['nb-e3'], action: 'SOP rewrite started: Inbound routing workflow', daysBack: 5 },
    { userId: mgr2Id, action: 'Engagement started: Alto Financial Digital Transformation Roadmap', daysBack: 35 },
    { userId: owner.id, action: 'Invoice NBI-2026-002 sent to Penrose Logistics — GBP 22000 outstanding', daysBack: 10 },
    { userId: owner.id, action: 'Invoice NBI-2026-004 now overdue — Sable Retail Group chaser sent', daysBack: 2 },
  ])

  await seedAlerts(company.id, [
    { senderId: owner.id, recipientId: mgr1Id, type: 'URGENT_TASK', title: 'Sable Retail invoice overdue — escalate', message: 'NBI-2026-004 is 15 days past due. Please contact Patrick Adkins directly and send a formal reminder letter.', priority: 'CRITICAL' },
    { senderId: mgr1Id, recipientId: nbUsers['nb-e3'], type: 'DEADLINE_WARNING', title: 'SOP rewrite due in 5 days', message: 'The Penrose SOP documents are due for client review on Friday. Please confirm progress before tomorrow standup.', priority: 'HIGH' },
  ])

  return company.id
}

// ---------------------------------------------------------------------------
// Workspace 3: Meridian Pulse — Content Creation Agency (mid)
// ---------------------------------------------------------------------------

async function seedMeridianPulse(hashedPw: string) {
  const cid = uid('co', 'meridian')

  const owner = await prisma.user.upsert({
    where: { email: 'nadia.el-amin@meridianpulse.co' },
    update: { password: hashedPw },
    create: { id: uid('u', 'mp-owner'), name: 'Nadia El-Amin', email: 'nadia.el-amin@meridianpulse.co', password: hashedPw, role: 'OWNER', accountStatus: 'ACTIVE' },
  })

  const company = await prisma.company.upsert({
    where: { id: cid },
    update: { name: 'Meridian Pulse' },
    create: {
      id: cid, name: 'Meridian Pulse', ownerId: owner.id, emailDomain: 'meridianpulse.co',
      companyType: 'CONTENT_CREATION_AGENCY', country: 'France', industry: 'Media and Entertainment',
      registrationNumber: 'MP-FR-2024-1127', status: 'ACTIVE', subscriptionStatus: 'ACTIVE',
      planType: 'STARTER', seatCount: 12, metadata: { _demo: DEMO_TAG },
    },
  })

  await prisma.user.update({ where: { id: owner.id }, data: { companyId: company.id } })

  const mpTeam = [
    { slug: 'mp-mgr1', name: 'Lucas Durand', email: 'l.durand@meridianpulse.co', role: 'MANAGER' },
    { slug: 'mp-mgr2', name: 'Chloe Bertrand', email: 'c.bertrand@meridianpulse.co', role: 'MANAGER' },
    { slug: 'mp-e1', name: 'Kaito Yamamoto', email: 'k.yamamoto@meridianpulse.co', role: 'EMPLOYEE' },
    { slug: 'mp-e2', name: 'Lea Moreau', email: 'l.moreau@meridianpulse.co', role: 'EMPLOYEE' },
    { slug: 'mp-e3', name: 'Sasha Volkov', email: 's.volkov@meridianpulse.co', role: 'EMPLOYEE' },
    { slug: 'mp-e4', name: 'Amina Diallo', email: 'a.diallo@meridianpulse.co', role: 'EMPLOYEE' },
    { slug: 'mp-e5', name: 'Jin-Ho Park', email: 'j.park@meridianpulse.co', role: 'EMPLOYEE' },
    { slug: 'mp-e6', name: 'Elise Fontaine', email: 'e.fontaine@meridianpulse.co', role: 'EMPLOYEE' },
    { slug: 'mp-e7', name: 'Omar Benali', email: 'o.benali@meridianpulse.co', role: 'EMPLOYEE' },
  ]

  const mpUsers: Record<string, string> = {}
  for (const u of mpTeam) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { password: hashedPw },
      create: { id: uid('u', u.slug), name: u.name, email: u.email, password: hashedPw, role: u.role, accountStatus: 'ACTIVE', companyId: company.id },
    })
    mpUsers[u.slug] = user.id
  }

  const mgr1Id = mpUsers['mp-mgr1']
  const mgr2Id = mpUsers['mp-mgr2']

  const catMusic = await prisma.projectCategory.upsert({ where: { companyId_name: { companyId: company.id, name: 'Music and Audio' } }, update: {}, create: { id: uid('cat', 'mp-music'), companyId: company.id, name: 'Music and Audio', description: 'Music videos, audio production, and artist promotion' } })
  const catVideo = await prisma.projectCategory.upsert({ where: { companyId_name: { companyId: company.id, name: 'Video Production' } }, update: {}, create: { id: uid('cat', 'mp-video'), companyId: company.id, name: 'Video Production', description: 'Short-form and long-form video campaigns' } })
  const catSocial = await prisma.projectCategory.upsert({ where: { companyId_name: { companyId: company.id, name: 'Social Content' } }, update: {}, create: { id: uid('cat', 'mp-social'), companyId: company.id, name: 'Social Content', description: 'Instagram Reels, TikTok, and YouTube content strategy' } })

  const mpC1 = await prisma.client.upsert({ where: { id: uid('cl', 'mp-sonance') }, update: {}, create: { id: uid('cl', 'mp-sonance'), companyId: company.id, companyName: 'Sonance Records', contactPerson: 'Antoine Favre', email: 'antoine.favre@sonancerecords.fr', phone: '+33-1-4230-8814', country: 'France', status: 'active' } })
  const mpC2 = await prisma.client.upsert({ where: { id: uid('cl', 'mp-velo') }, update: {}, create: { id: uid('cl', 'mp-velo'), companyId: company.id, companyName: 'Velo Sport Brand', contactPerson: 'Elena Morin', email: 'e.morin@velosport.fr', phone: '+33-4-6712-5500', country: 'France', status: 'active' } })
  const mpC3 = await prisma.client.upsert({ where: { id: uid('cl', 'mp-elara') }, update: {}, create: { id: uid('cl', 'mp-elara'), companyId: company.id, companyName: 'Elara Cosmetics', contactPerson: 'Isabeau Roche', email: 'i.roche@elaracosmetics.com', phone: '+33-1-5551-0204', country: 'France', status: 'active' } })

  const mpP1 = await prisma.project.upsert({ where: { id: uid('proj', 'mp-sonance-ep') }, update: {}, create: { id: uid('proj', 'mp-sonance-ep'), companyId: company.id, categoryId: catMusic.id, clientId: mpC1.id, clientName: mpC1.companyName, managerId: mgr1Id, title: 'Sonance Records — EP Launch Campaign Midnight Circuit', description: 'Full campaign for the Midnight Circuit EP release: music video production, social content series, Spotify Canvas, and YouTube Shorts cut-downs.' } })
  const mpP2 = await prisma.project.upsert({ where: { id: uid('proj', 'mp-velo-spring') }, update: {}, create: { id: uid('proj', 'mp-velo-spring'), companyId: company.id, categoryId: catVideo.id, clientId: mpC2.id, clientName: mpC2.companyName, managerId: mgr2Id, title: 'Velo Sport — Spring Collection Brand Film', description: 'A 90-second hero brand film for the Spring 2026 collection launch. Supported by 6 Instagram Reels, 3 TikTok videos, and a behind-the-scenes YouTube vlog.' } })
  const mpP3 = await prisma.project.upsert({ where: { id: uid('proj', 'mp-elara-social') }, update: {}, create: { id: uid('proj', 'mp-elara-social'), companyId: company.id, categoryId: catSocial.id, clientId: mpC3.id, clientName: mpC3.companyName, managerId: mgr1Id, title: 'Elara Cosmetics — Q2 Influencer Content Series', description: '12-week social content series with weekly Reels, influencer coordination, and monthly analytics reports.' } })

  const makeBrief = (slug: string, campaignId: string, clientId: string | null, createdById: string, title: string, description: string, daysBack: number) =>
    prisma.brief.upsert({ where: { id: uid('brief', slug) }, update: {}, create: { id: uid('brief', slug), companyId: company.id, campaignId, clientId: clientId ?? undefined, createdById, title, description, status: 'APPROVED', approvedAt: daysAgo(daysBack) } })

  const mpBr1a = await makeBrief('mp-sonance-mv', mpP1.id, mpC1.id, mgr1Id, 'Music Video — Midnight Circuit', 'Produce a 3:45-min official music video. Cyberpunk aesthetic, location shoot in Paris, colour grade and VFX post-production.', 55)
  const mpBr1b = await makeBrief('mp-sonance-social', mpP1.id, mpC1.id, mgr1Id, 'Social Content Series — 8 Posts', 'Create 8 Instagram posts (mix of static and Reel) to support the EP launch over 4 weeks.', 50)
  const mpBr2a = await makeBrief('mp-velo-film', mpP2.id, mpC2.id, mgr2Id, 'Brand Film — 90-Second Hero', 'Pre-production, 2-day shoot, post-production. Cinematic cycling aesthetic featuring 3 athletes.', 30)
  const mpBr3a = await makeBrief('mp-elara-q2', mpP3.id, mpC3.id, mgr1Id, 'Q2 Social Content — Weekly Reels and Posts', '12 weeks of content: 3 posts per week, weekly Reel script and direction, influencer coordination for 4 collabs.', 18)

  const makeDel = (slug: string, campaignId: string, briefId: string, title: string, type: string, status: string, approvalState: string, revisionCount: number, dueAt: Date, deliveredAt?: Date) =>
    prisma.deliverable.upsert({ where: { id: uid('del', slug) }, update: {}, create: { id: uid('del', slug), companyId: company.id, campaignId, briefId, title, type, status, approvalState, revisionCount, dueAt, deliveredAt } })

  const mpD1a = await makeDel('mp-mv-final', mpP1.id, mpBr1a.id, 'Music Video — Final Master', 'VIDEO', 'APPROVED', 'APPROVED', 2, daysAgo(15), daysAgo(12))
  const mpD1b = await makeDel('mp-social-posts', mpP1.id, mpBr1b.id, 'Social Posts — 8 Content Pieces', 'VIDEO', 'CLIENT_REVIEW', 'PENDING', 1, daysFromNow(4))
  const mpD2a = await makeDel('mp-velo-film', mpP2.id, mpBr2a.id, 'Brand Film — 90-Second Final Cut', 'VIDEO', 'INTERNAL_REVIEW', 'PENDING', 0, daysFromNow(18))
  const mpD3a = await makeDel('mp-elara-week1-4', mpP3.id, mpBr3a.id, 'Weeks 1 to 4 Content Package', 'VIDEO', 'INTERNAL_REVIEW', 'PENDING', 0, daysFromNow(6))

  const mpTasks: TaskDef[] = [
    { id: uid('task', 'mp-t1'), title: 'Music video shoot — Paris location 2-day', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: mpUsers['mp-e1'], projectId: mpP1.id, deliverableId: mpD1a.id, deadline: daysAgo(30) },
    { id: uid('task', 'mp-t2'), title: 'Colour grade and VFX — music video', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: mpUsers['mp-e2'], projectId: mpP1.id, deliverableId: mpD1a.id, deadline: daysAgo(16) },
    { id: uid('task', 'mp-t3'), title: 'Export music video — all delivery specs', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: mpUsers['mp-e2'], projectId: mpP1.id, deliverableId: mpD1a.id, deadline: daysAgo(12) },
    { id: uid('task', 'mp-t4'), title: 'Create social Reels — weeks 1 and 2', priority: 'MEDIUM', stage: 'IN_PROGRESS', progress: 60, assigneeId: mpUsers['mp-e3'], projectId: mpP1.id, deliverableId: mpD1b.id, deadline: daysFromNow(3) },
    { id: uid('task', 'mp-t5'), title: 'Static posts — weeks 1 and 2 design', priority: 'MEDIUM', stage: 'IN_PROGRESS', progress: 40, assigneeId: mpUsers['mp-e4'], projectId: mpP1.id, deliverableId: mpD1b.id, deadline: daysFromNow(4) },
    { id: uid('task', 'mp-t6'), title: 'Velo brand film — pre-production and storyboard', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: mpUsers['mp-e5'], projectId: mpP2.id, deliverableId: mpD2a.id, deadline: daysAgo(15) },
    { id: uid('task', 'mp-t7'), title: 'Velo brand film — 2-day location shoot', priority: 'HIGH', stage: 'DONE', progress: 100, assigneeId: mpUsers['mp-e1'], projectId: mpP2.id, deliverableId: mpD2a.id, deadline: daysAgo(8) },
    { id: uid('task', 'mp-t8'), title: 'Velo brand film — rough cut edit', priority: 'HIGH', stage: 'IN_PROGRESS', progress: 35, assigneeId: mpUsers['mp-e2'], projectId: mpP2.id, deliverableId: mpD2a.id, deadline: daysFromNow(8) },
    { id: uid('task', 'mp-t9'), title: 'Elara — content plan and post schedule weeks 1 to 4', priority: 'HIGH', stage: 'IN_PROGRESS', progress: 50, assigneeId: mpUsers['mp-e6'], projectId: mpP3.id, deliverableId: mpD3a.id, deadline: daysFromNow(4) },
    { id: uid('task', 'mp-t10'), title: 'Elara — Reel scripts weeks 1 and 2', priority: 'MEDIUM', stage: 'TODO', progress: 0, assigneeId: mpUsers['mp-e7'], projectId: mpP3.id, deliverableId: mpD3a.id, deadline: daysFromNow(6) },
  ]
  for (const t of mpTasks) await upsertTask(t)

  await upsertInvoice({ id: uid('inv', 'mp-001'), companyId: company.id, createdById: owner.id, clientId: mpC1.id, invoiceNumber: 'MP-2026-001', clientName: 'Sonance Records', clientEmail: 'antoine.favre@sonancerecords.fr', status: 'paid', currency: 'EUR', issueDate: daysAgo(60), dueDate: daysAgo(30), paidAt: daysAgo(28), sentAt: daysAgo(60), subtotal: 22000, taxRate: 20, items: [{ description: 'Music video production pre-production and shoot', quantity: 1, unitPrice: 14000 }, { description: 'Post-production editing VFX colour grade', quantity: 1, unitPrice: 8000 }] })
  await upsertInvoice({ id: uid('inv', 'mp-002'), companyId: company.id, createdById: owner.id, clientId: mpC1.id, invoiceNumber: 'MP-2026-002', clientName: 'Sonance Records', clientEmail: 'antoine.favre@sonancerecords.fr', status: 'sent', currency: 'EUR', issueDate: daysAgo(8), dueDate: daysFromNow(22), sentAt: daysAgo(8), subtotal: 8500, taxRate: 20, items: [{ description: 'Social content series 8 posts weeks 1 to 4', quantity: 1, unitPrice: 8500 }] })
  await upsertInvoice({ id: uid('inv', 'mp-003'), companyId: company.id, createdById: owner.id, clientId: mpC2.id, invoiceNumber: 'MP-2026-003', clientName: 'Velo Sport Brand', clientEmail: 'e.morin@velosport.fr', status: 'paid', currency: 'EUR', issueDate: daysAgo(32), dueDate: daysAgo(12), paidAt: daysAgo(10), sentAt: daysAgo(32), subtotal: 7500, taxRate: 20, items: [{ description: 'Brand film pre-production storyboard location scouting casting', quantity: 1, unitPrice: 7500 }] })
  await upsertInvoice({ id: uid('inv', 'mp-004'), companyId: company.id, createdById: owner.id, clientId: mpC2.id, invoiceNumber: 'MP-2026-004', clientName: 'Velo Sport Brand', clientEmail: 'e.morin@velosport.fr', status: 'draft', currency: 'EUR', issueDate: daysAgo(1), dueDate: daysFromNow(29), subtotal: 18000, taxRate: 20, items: [{ description: 'Brand film 2-day shoot and post-production', quantity: 1, unitPrice: 18000 }] })
  await upsertInvoice({ id: uid('inv', 'mp-005'), companyId: company.id, createdById: owner.id, clientId: mpC3.id, invoiceNumber: 'MP-2026-005', clientName: 'Elara Cosmetics', clientEmail: 'i.roche@elaracosmetics.com', status: 'sent', currency: 'EUR', issueDate: daysAgo(6), dueDate: daysFromNow(24), sentAt: daysAgo(6), subtotal: 9000, taxRate: 20, items: [{ description: 'Q2 social content retainer Month 1 strategy weeks 1 to 4', quantity: 1, unitPrice: 9000 }] })

  await upsertContract({ id: uid('con', 'mp-c001'), companyId: company.id, clientId: mpC1.id, projectId: mpP1.id, createdById: owner.id, contractNumber: 'MP-CON-2026-001', title: 'Music Video Production Agreement — Sonance Records', type: 'SERVICE_AGREEMENT', status: 'signed', effectiveDate: daysAgo(58), expiryDate: daysFromNow(30), signedAt: daysAgo(55), currency: 'EUR' })
  await upsertContract({ id: uid('con', 'mp-c002'), companyId: company.id, clientId: mpC2.id, projectId: mpP2.id, createdById: owner.id, contractNumber: 'MP-CON-2026-002', title: 'Brand Film Production Agreement — Velo Sport Brand', type: 'SERVICE_AGREEMENT', status: 'signed', effectiveDate: daysAgo(33), expiryDate: daysFromNow(45), signedAt: daysAgo(30), currency: 'EUR' })
  await upsertContract({ id: uid('con', 'mp-c003'), companyId: company.id, clientId: mpC3.id, projectId: mpP3.id, createdById: owner.id, contractNumber: 'MP-CON-2026-003', title: 'Content Retainer Agreement — Elara Cosmetics Q2 2026', type: 'RETAINER', status: 'signed', effectiveDate: daysAgo(18), expiryDate: daysFromNow(74), signedAt: daysAgo(16), currency: 'EUR' })

  await upsertCalendarEvents(company.id, mgr1Id, [
    { id: uid('cal', 'mp-sonance-shoot'), title: 'Midnight Circuit — Paris Location Shoot Day 1', type: 'PROJECT_EVENT', projectId: mpP1.id, startsAt: daysAgo(32), endsAt: new Date(daysAgo(32).getTime() + 12 * 3600000), color: '#ec4899' },
    { id: uid('cal', 'mp-sonance-review'), title: 'Social Posts — Client Review Call', type: 'MEETING', projectId: mpP1.id, startsAt: daysFromNow(5), endsAt: new Date(daysFromNow(5).getTime() + 3600000), color: '#ec4899' },
    { id: uid('cal', 'mp-velo-shoot'), title: 'Velo Sport — Brand Film Shoot Day 1', type: 'PROJECT_EVENT', projectId: mpP2.id, startsAt: daysAgo(8), endsAt: new Date(daysAgo(8).getTime() + 10 * 3600000), color: '#14b8a6' },
    { id: uid('cal', 'mp-velo-roughcut'), title: 'Velo — Rough Cut Internal Review', type: 'MEETING', projectId: mpP2.id, startsAt: daysFromNow(8), endsAt: new Date(daysFromNow(8).getTime() + 2 * 3600000), color: '#14b8a6' },
    { id: uid('cal', 'mp-elara-kickoff'), title: 'Elara Cosmetics — Q2 Content Strategy Session', type: 'MEETING', projectId: mpP3.id, startsAt: daysAgo(17), endsAt: new Date(daysAgo(17).getTime() + 2 * 3600000), color: '#a855f7' },
    { id: uid('cal', 'mp-team-retro'), title: 'Monthly Team Retrospective', type: 'MEETING', startsAt: daysFromNow(12), endsAt: new Date(daysFromNow(12).getTime() + 5400000), color: '#6366f1' },
  ])

  await seedActivities(company.id, [
    { userId: mgr1Id, action: 'Campaign launched: Sonance Records Midnight Circuit EP', daysBack: 58 },
    { userId: mpUsers['mp-e1'], action: 'Shoot completed: Paris location 2 days 6 scenes', daysBack: 30 },
    { userId: mpUsers['mp-e2'], action: 'Music video delivered — Final Master approved by Sonance Records', daysBack: 12 },
    { userId: mpUsers['mp-e3'], action: 'Reels editing started: weeks 1-2 social content', daysBack: 3 },
    { userId: mgr2Id, action: 'Campaign started: Velo Sport Brand Film pre-production', daysBack: 33 },
    { userId: mpUsers['mp-e5'], action: 'Storyboard approved: Velo Sport Brand Film', daysBack: 15 },
    { userId: mpUsers['mp-e1'], action: 'Shoot completed: Velo Sport Vosges location 2 days', daysBack: 8 },
    { userId: owner.id, action: 'Invoice MP-2026-002 sent to Sonance Records — EUR 8500 outstanding', daysBack: 8 },
  ])

  await seedAlerts(company.id, [
    { senderId: mgr1Id, recipientId: mpUsers['mp-e3'], type: 'DEADLINE_WARNING', title: 'Reels due for client review — 3 days', message: 'The Sonance social Reels for weeks 1-2 go to client review on Monday. Please finalise all captions and thumbnail frames by Friday.', priority: 'HIGH' },
    { senderId: mgr2Id, recipientId: mpUsers['mp-e2'], type: 'URGENT_TASK', title: 'Velo rough cut — prioritise this week', message: 'The client has moved the rough cut review forward to next Thursday. Please prioritise the Velo edit over other tasks this week.', priority: 'CRITICAL' },
  ])

  return company.id
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export type SeedDemoResult = {
  workspaces: { name: string; id: string; type: string }[]
  password: string
  accounts: { workspace: string; role: string; email: string }[]
}

export async function runDemoSeed(reset = false): Promise<SeedDemoResult> {
  if (reset) {
    const existing = await prisma.company.findMany({
      where: { metadata: { path: ['_demo'], equals: DEMO_TAG } },
      select: { id: true },
    })
    for (const c of existing) {
      await prisma.company.delete({ where: { id: c.id } })
    }
  }

  const hashedPw = await bcrypt.hash(DEMO_PASSWORD, DEMO_BCRYPT_ROUNDS)

  const luminaryId = await seedLuminaryStudio(hashedPw)
  const northbridgeId = await seedNorthbridgeGroup(hashedPw)
  const meridianId = await seedMeridianPulse(hashedPw)

  return {
    workspaces: [
      { name: 'Luminary Studio', id: luminaryId, type: 'DIGITAL_AGENCY' },
      { name: 'Northbridge Group', id: northbridgeId, type: 'ENTERPRISE_OPERATIONS' },
      { name: 'Meridian Pulse', id: meridianId, type: 'CONTENT_CREATION_AGENCY' },
    ],
    password: DEMO_PASSWORD,
    accounts: [
      { workspace: 'Luminary Studio', role: 'OWNER', email: 'claire.martin@luminarystudio.io' },
      { workspace: 'Luminary Studio', role: 'MANAGER', email: 'james.okafor@luminarystudio.io' },
      { workspace: 'Luminary Studio', role: 'EMPLOYEE', email: 'sofia.reyes@luminarystudio.io' },
      { workspace: 'Northbridge Group', role: 'OWNER', email: 'david.osei@northbridgegroup.com' },
      { workspace: 'Northbridge Group', role: 'MANAGER', email: 'h.prescott@northbridgegroup.com' },
      { workspace: 'Northbridge Group', role: 'EMPLOYEE', email: 'a.thornton@northbridgegroup.com' },
      { workspace: 'Meridian Pulse', role: 'OWNER', email: 'nadia.el-amin@meridianpulse.co' },
      { workspace: 'Meridian Pulse', role: 'MANAGER', email: 'l.durand@meridianpulse.co' },
      { workspace: 'Meridian Pulse', role: 'EMPLOYEE', email: 'k.yamamoto@meridianpulse.co' },
    ],
  }
}
