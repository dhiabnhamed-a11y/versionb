import type { FinancialAccountType, FinancialNormalBalance } from '@prisma/client'

export type StandardAccountCategory = {
  code: string
  name: string
  rootType: FinancialAccountType
  sortOrder: number
}

export type StandardAgencyAccount = {
  code: string
  name: string
  type: FinancialAccountType
  normalBalance: FinancialNormalBalance
  categoryCode: string
  parentCode?: string
}

export const STANDARD_AGENCY_CATEGORIES: StandardAccountCategory[] = [
  { code: 'ASSET_CURRENT', name: 'Current Assets', rootType: 'ASSET', sortOrder: 100 },
  { code: 'LIABILITY_CURRENT', name: 'Current Liabilities', rootType: 'LIABILITY', sortOrder: 200 },
  { code: 'EQUITY_OWNER', name: 'Equity', rootType: 'EQUITY', sortOrder: 300 },
  { code: 'REVENUE_OPERATING', name: 'Operating Revenue', rootType: 'REVENUE', sortOrder: 400 },
  { code: 'EXPENSE_DELIVERY', name: 'Delivery Costs', rootType: 'EXPENSE', sortOrder: 500 },
  { code: 'EXPENSE_OPERATING', name: 'Operating Expenses', rootType: 'EXPENSE', sortOrder: 600 },
  { code: 'EXPENSE_OTHER', name: 'Other Expenses', rootType: 'EXPENSE', sortOrder: 900 },
]

export const STANDARD_AGENCY_ACCOUNTS: StandardAgencyAccount[] = [
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

export const STANDARD_AGENCY_DEFAULT_ACCOUNT_CODES = {
  cash: '1010',
  receivable: '1100',
  payable: '2000',
  retainedEarnings: '3100',
}
