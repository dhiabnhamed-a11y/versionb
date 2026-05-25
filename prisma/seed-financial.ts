/**
 * Financial seed script — creates a standard chart of accounts,
 * a 2026 financial period, and sample posted journal entries.
 *
 * Usage: npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-financial.ts
 * Or via package.json: "prisma": { "seed": "..." }
 */
import { PrismaClient } from '@prisma/client'
import type { FinancialAccountType, FinancialNormalBalance, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Standard Chart of Accounts (same payload as POST /setup/standard-chart)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { code: 'ASSET_CURRENT', name: 'Current Assets', rootType: 'ASSET' as FinancialAccountType, sortOrder: 100 },
  { code: 'LIABILITY_CURRENT', name: 'Current Liabilities', rootType: 'LIABILITY' as FinancialAccountType, sortOrder: 200 },
  { code: 'EQUITY_OWNER', name: 'Equity', rootType: 'EQUITY' as FinancialAccountType, sortOrder: 300 },
  { code: 'REVENUE_OPERATING', name: 'Operating Revenue', rootType: 'REVENUE' as FinancialAccountType, sortOrder: 400 },
  { code: 'EXPENSE_DELIVERY', name: 'Delivery Costs', rootType: 'EXPENSE' as FinancialAccountType, sortOrder: 500 },
  { code: 'EXPENSE_OPERATING', name: 'Operating Expenses', rootType: 'EXPENSE' as FinancialAccountType, sortOrder: 600 },
  { code: 'EXPENSE_OTHER', name: 'Other Expenses', rootType: 'EXPENSE' as FinancialAccountType, sortOrder: 900 },
]

type AcctDef = { code: string; name: string; type: FinancialAccountType; normalBalance: FinancialNormalBalance; categoryCode: string; parentCode?: string }

const ACCOUNTS: AcctDef[] = [
  { code: '1000', name: 'Cash and Bank', type: 'ASSET', normalBalance: 'DEBIT', categoryCode: 'ASSET_CURRENT' },
  { code: '1010', name: 'Operating Bank', type: 'ASSET', normalBalance: 'DEBIT', categoryCode: 'ASSET_CURRENT', parentCode: '1000' },
  { code: '1020', name: 'Stripe/Dodo Clearing', type: 'ASSET', normalBalance: 'DEBIT', categoryCode: 'ASSET_CURRENT', parentCode: '1000' },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', normalBalance: 'DEBIT', categoryCode: 'ASSET_CURRENT' },
  { code: '1200', name: 'Prepaid Expenses', type: 'ASSET', normalBalance: 'DEBIT', categoryCode: 'ASSET_CURRENT' },
  { code: '1300', name: 'Work in Progress', type: 'ASSET', normalBalance: 'DEBIT', categoryCode: 'ASSET_CURRENT' },
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', normalBalance: 'CREDIT', categoryCode: 'LIABILITY_CURRENT' },
  { code: '2100', name: 'Payroll Liabilities', type: 'LIABILITY', normalBalance: 'CREDIT', categoryCode: 'LIABILITY_CURRENT' },
  { code: '2200', name: 'Sales Tax / VAT Payable', type: 'LIABILITY', normalBalance: 'CREDIT', categoryCode: 'LIABILITY_CURRENT' },
  { code: '2300', name: 'Deferred Revenue', type: 'LIABILITY', normalBalance: 'CREDIT', categoryCode: 'LIABILITY_CURRENT' },
  { code: '3000', name: 'Owner Equity', type: 'EQUITY', normalBalance: 'CREDIT', categoryCode: 'EQUITY_OWNER' },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY', normalBalance: 'CREDIT', categoryCode: 'EQUITY_OWNER' },
  { code: '4000', name: 'Service Revenue', type: 'REVENUE', normalBalance: 'CREDIT', categoryCode: 'REVENUE_OPERATING' },
  { code: '4100', name: 'Retainer Revenue', type: 'REVENUE', normalBalance: 'CREDIT', categoryCode: 'REVENUE_OPERATING' },
  { code: '4200', name: 'Project Revenue', type: 'REVENUE', normalBalance: 'CREDIT', categoryCode: 'REVENUE_OPERATING' },
  { code: '4300', name: 'Pass-through Revenue', type: 'REVENUE', normalBalance: 'CREDIT', categoryCode: 'REVENUE_OPERATING' },
  { code: '5000', name: 'Delivery Labor Cost', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_DELIVERY' },
  { code: '5100', name: 'Contractor Cost', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_DELIVERY' },
  { code: '5200', name: 'Software and Tools', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_OPERATING' },
  { code: '5300', name: 'Production Costs', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_DELIVERY' },
  { code: '6000', name: 'Payroll Expense', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_OPERATING' },
  { code: '6100', name: 'Marketing Expense', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_OPERATING' },
  { code: '6200', name: 'Travel and Meals', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_OPERATING' },
  { code: '6300', name: 'Rent and Utilities', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_OPERATING' },
  { code: '6400', name: 'Professional Fees', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_OPERATING' },
  { code: '6500', name: 'Bank and Payment Fees', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_OPERATING' },
  { code: '7000', name: 'Depreciation Expense', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_OTHER' },
  { code: '8000', name: 'Other Income', type: 'REVENUE', normalBalance: 'CREDIT', categoryCode: 'REVENUE_OPERATING' },
  { code: '9000', name: 'Income Tax Expense', type: 'EXPENSE', normalBalance: 'DEBIT', categoryCode: 'EXPENSE_OTHER' },
]

const DEFAULT_CODES = ['1010', '1100', '2000', '3100']

// ---------------------------------------------------------------------------
// Seed — creates COA, period, and sample entries for a given companyId
// ---------------------------------------------------------------------------

async function seedCompanyFinancials(companyId: string, userId: string) {
  // 1. Check if already seeded
  const existingChart = await prisma.chartOfAccount.findFirst({ where: { companyId, isDefault: true } })
  if (existingChart) {
    console.log(`  Chart of accounts already exists for company ${companyId}, skipping COA seed.`)
  } else {
    console.log(`  Creating chart of accounts for company ${companyId}...`)

    // Create categories
    await prisma.accountCategory.createMany({
      data: CATEGORIES.map((c) => ({ companyId, code: c.code, name: c.name, rootType: c.rootType, sortOrder: c.sortOrder })),
      skipDuplicates: true,
    })

    const categoryMap = new Map(
      (await prisma.accountCategory.findMany({ where: { companyId }, select: { id: true, code: true } })).map((c) => [c.code, c.id])
    )

    // Create chart
    const chart = await prisma.chartOfAccount.create({
      data: { companyId, name: 'Standard Chart of Accounts', description: 'Standard agency/service business COA', currency: 'USD', isDefault: true },
    })

    // Create accounts (with parent references)
    const parentMap = new Map<string, string>()
    const createdAccounts: { id: string; code: string }[] = []

    for (const acct of ACCOUNTS) {
      const data: Prisma.AccountUncheckedCreateInput = {
        companyId,
        chartId: chart.id,
        categoryId: categoryMap.get(acct.categoryCode) ?? null,
        code: acct.code,
        name: acct.name,
        type: acct.type,
        normalBalance: acct.normalBalance,
        currency: 'USD',
        isSystem: true,
      }
      if (acct.parentCode && parentMap.has(acct.parentCode)) {
        data.parentAccountId = parentMap.get(acct.parentCode)
      }
      const created = await prisma.account.create({ data })
      parentMap.set(acct.code, created.id)
      createdAccounts.push({ id: created.id, code: created.code })
    }

    // Upsert ErpWorkspaceSettings
    const defaultAccountIds = createdAccounts.filter((a) => DEFAULT_CODES.includes(a.code))
    const getDefaultId = (code: string) => defaultAccountIds.find((a) => a.code === code)?.id ?? null

    await prisma.erpWorkspaceSettings.upsert({
      where: { companyId },
      create: {
        companyId,
        baseCurrency: 'USD',
        accountingBasis: 'ACCRUAL',
        defaultChartId: chart.id,
        defaultCashAccountId: getDefaultId('1010'),
        defaultReceivableAccountId: getDefaultId('1100'),
        defaultPayableAccountId: getDefaultId('2000'),
        retainedEarningsAccountId: getDefaultId('3100'),
      },
      update: {
        defaultChartId: chart.id,
        defaultCashAccountId: getDefaultId('1010'),
        defaultReceivableAccountId: getDefaultId('1100'),
        defaultPayableAccountId: getDefaultId('2000'),
        retainedEarningsAccountId: getDefaultId('3100'),
      },
    })

    console.log(`  Created ${createdAccounts.length} accounts.`)
  }

  // 2. Create / find FinancialPeriod
  let period = await prisma.financialPeriod.findFirst({ where: { companyId, name: 'FY 2026' } })
  if (!period) {
    console.log(`  Creating FY 2026 period...`)
    period = await prisma.financialPeriod.create({
      data: {
        companyId,
        name: 'FY 2026',
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2026-12-31'),
        status: 'OPEN',
      },
    })
  }

  // 3. Refresh account map (in case seeded previously)
  const allAccounts = await prisma.account.findMany({ where: { companyId, deletedAt: null }, select: { id: true, code: true, name: true, type: true, normalBalance: true } })
  const accountByCode = new Map(allAccounts.map((a) => [a.code, a]))
  const getAccountId = (code: string) => accountByCode.get(code)?.id

  const cashId = getAccountId('1010')!
  const revenueId = getAccountId('4000')!
  const equityId = getAccountId('3000')!
  const arId = getAccountId('1100')!
  const expenseId = getAccountId('6000')!

  // 4. Create sample posted journal entries
  const existingJE = await prisma.journalEntry.count({ where: { companyId } })
  if (existingJE > 0) {
    console.log(`  ${existingJE} journal entries already exist, skipping sample entries.`)
    return
  }

  console.log(`  Creating sample journal entries...`)

  type SampleLine = { accountId: string; debit: string; credit: string; description?: string }
  const samples: { transactionDate: Date; memo: string; lines: SampleLine[] }[] = [
    {
      transactionDate: new Date('2026-01-01'),
      memo: 'Owner investment - opening balance',
      lines: [
        { accountId: cashId, debit: '50000.00', credit: '', description: 'Initial deposit' },
        { accountId: equityId, debit: '', credit: '50000.00', description: 'Owner capital contribution' },
      ],
    },
    {
      transactionDate: new Date('2026-01-15'),
      memo: 'Client invoice - Q1 retainer',
      lines: [
        { accountId: arId, debit: '15000.00', credit: '', description: 'Invoice INV-2026-001' },
        { accountId: revenueId, debit: '', credit: '15000.00', description: 'Retainer revenue - Q1 2026' },
      ],
    },
    {
      transactionDate: new Date('2026-01-20'),
      memo: 'Office rent - January',
      lines: [
        { accountId: expenseId, debit: '3000.00', credit: '', description: 'Rent January 2026' },
        { accountId: cashId, debit: '', credit: '3000.00', description: 'Rent payment' },
      ],
    },
    {
      transactionDate: new Date('2026-02-01'),
      memo: 'Client payment received',
      lines: [
        { accountId: cashId, debit: '15000.00', credit: '', description: 'Payment received INV-2026-001' },
        { accountId: arId, debit: '', credit: '15000.00', description: 'Invoice payment' },
      ],
    },
    {
      transactionDate: new Date('2026-02-15'),
      memo: 'Software subscriptions - monthly',
      lines: [
        { accountId: cashId, debit: '', credit: '850.00', description: 'Various SaaS tools' },
        { accountId: expenseId, debit: '850.00', credit: '', description: 'Software expenses' },
      ],
    },
    {
      transactionDate: new Date('2026-03-01'),
      memo: 'Contractor payment - March',
      lines: [
        { accountId: expenseId, debit: '5000.00', credit: '', description: 'Freelance developer' },
        { accountId: cashId, debit: '', credit: '5000.00', description: 'Wire transfer' },
      ],
    },
  ]

  let entryNumberCounter = 1

  for (const sample of samples) {
    const entryNumber = `JE-2026-${String(entryNumberCounter).padStart(6, '0')}`
    entryNumberCounter++

    // Compute totals
    let totalDebit = '0'
    let totalCredit = '0'
    for (const line of sample.lines) {
      if (line.debit) totalDebit = (parseFloat(totalDebit) + parseFloat(line.debit)).toFixed(6)
      if (line.credit) totalCredit = (parseFloat(totalCredit) + parseFloat(line.credit)).toFixed(6)
    }

    // Create journal entry
    const je = await prisma.journalEntry.create({
      data: {
        companyId,
        periodId: period.id,
        createdById: userId,
        entryNumber,
        status: 'POSTED',
        sourceType: 'MANUAL',
        memo: sample.memo,
        currency: 'USD',
        transactionDate: sample.transactionDate,
        totalDebit,
        totalCredit,
        totalDebitMinor: BigInt(Math.round(parseFloat(totalDebit) * 100)),
        totalCreditMinor: BigInt(Math.round(parseFloat(totalCredit) * 100)),
        postedAt: new Date(),
        postedById: userId,
      },
    })

    // Create journal lines
    for (let i = 0; i < sample.lines.length; i++) {
      const line = sample.lines[i]
      const acct = allAccounts.find((a) => a.id === line.accountId)
      if (!acct) {
        console.warn(`    Account ${line.accountId} not found, skipping line`)
        continue
      }

      const debit = line.debit || '0'
      const credit = line.credit || '0'
      const debitMinor = BigInt(Math.round(parseFloat(debit) * 100))
      const creditMinor = BigInt(Math.round(parseFloat(credit) * 100))

      const jl = await prisma.journalLine.create({
        data: {
          companyId,
          journalEntryId: je.id,
          accountId: line.accountId,
          lineNumber: i + 1,
          description: line.description ?? sample.memo,
          debit,
          credit,
          debitMinor,
          creditMinor,
          baseDebitMinor: debitMinor,
          baseCreditMinor: creditMinor,
          currency: 'USD',
        },
      })

      // Create Ledger row
      const balanceImpact = acct.normalBalance === 'DEBIT'
        ? (parseFloat(debit) - parseFloat(credit)).toFixed(6)
        : (parseFloat(credit) - parseFloat(debit)).toFixed(6)

      const balanceImpactMinor = acct.normalBalance === 'DEBIT'
        ? Number(debitMinor) - Number(creditMinor)
        : Number(creditMinor) - Number(debitMinor)

      await prisma.ledger.create({
        data: {
          companyId,
          periodId: period.id,
          accountId: line.accountId,
          journalEntryId: je.id,
          journalLineId: jl.id,
          postingDate: sample.transactionDate,
          debit,
          credit,
          balanceImpact,
          debitMinor,
          creditMinor,
          balanceImpactMinor: BigInt(balanceImpactMinor),
          baseDebitMinor: debitMinor,
          baseCreditMinor: creditMinor,
          currency: 'USD',
          sourceType: 'MANUAL',
        },
      })
    }

    console.log(`    ${entryNumber}: ${sample.memo}`)
  }

  console.log(`  Created ${samples.length} sample journal entries with ledger postings.`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const companyId = process.env.SEED_COMPANY_ID
  const userId = process.env.SEED_USER_ID

  if (companyId && userId) {
    console.log(`Seeding financial data for company ${companyId}...`)
    await seedCompanyFinancials(companyId, userId)
  } else {
    // Find first company with an owner
    const company = await prisma.company.findFirst({
      where: { status: 'ACTIVE' },
      include: { owner: { select: { id: true, name: true, email: true } } },
    })

    if (!company) {
      console.error('No active company found. Run prisma/seed.ts first or set SEED_COMPANY_ID / SEED_USER_ID.')
      process.exit(1)
    }

    const ownerId = company.owner?.id
    if (!ownerId) {
      console.error(`Company ${company.id} has no owner.`)
      process.exit(1)
    }

    console.log(`Seeding financial data for company: ${company.name} (${company.id})`)
    console.log(`Owner: ${company.owner?.name ?? 'Unknown'} (${company.owner?.email ?? 'N/A'})`)
    await seedCompanyFinancials(company.id, ownerId)
  }

  console.log('Financial seed complete.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
