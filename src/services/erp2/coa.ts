import type { $Enums } from '@prisma/client'

export type CoaEntry = {
  code: string
  name: string
  type: $Enums.ERPAccountType
  parentCode?: string
}

export const STANDARD_COA: CoaEntry[] = [
  // Assets
  { code: '1000', name: 'Current Assets', type: 'ASSET' },
  { code: '1010', name: 'Cash and Bank', type: 'ASSET', parentCode: '1000' },
  { code: '1020', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1000' },
  { code: '1030', name: 'Prepaid Expenses', type: 'ASSET', parentCode: '1000' },
  { code: '1100', name: 'Non-Current Assets', type: 'ASSET' },
  { code: '1110', name: 'Property and Equipment', type: 'ASSET', parentCode: '1100' },
  { code: '1120', name: 'Accumulated Depreciation', type: 'ASSET', parentCode: '1100' },

  // Liabilities
  { code: '2000', name: 'Current Liabilities', type: 'LIABILITY' },
  { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2020', name: 'Accrued Expenses', type: 'LIABILITY', parentCode: '2000' },
  { code: '2030', name: 'Deferred Revenue', type: 'LIABILITY', parentCode: '2000' },
  { code: '2100', name: 'Non-Current Liabilities', type: 'LIABILITY' },
  { code: '2110', name: 'Long-Term Debt', type: 'LIABILITY', parentCode: '2100' },

  // Equity
  { code: '3000', name: 'Equity', type: 'EQUITY' },
  { code: '3010', name: 'Owner Equity', type: 'EQUITY', parentCode: '3000' },
  { code: '3020', name: 'Retained Earnings', type: 'EQUITY', parentCode: '3000' },

  // Revenue
  { code: '4000', name: 'Revenue', type: 'REVENUE' },
  { code: '4010', name: 'Service Revenue', type: 'REVENUE', parentCode: '4000' },
  { code: '4020', name: 'Product Revenue', type: 'REVENUE', parentCode: '4000' },

  // Expenses
  { code: '5000', name: 'Operating Expenses', type: 'EXPENSE' },
  { code: '5010', name: 'Salaries and Wages', type: 'EXPENSE', parentCode: '5000' },
  { code: '5020', name: 'Marketing and Sales', type: 'EXPENSE', parentCode: '5000' },
  { code: '5030', name: 'Rent and Facilities', type: 'EXPENSE', parentCode: '5000' },
  { code: '5040', name: 'Software and Subscriptions', type: 'EXPENSE', parentCode: '5000' },
  { code: '5050', name: 'Professional Fees', type: 'EXPENSE', parentCode: '5000' },
  { code: '5060', name: 'Travel and Meals', type: 'EXPENSE', parentCode: '5000' },
  { code: '5070', name: 'Depreciation', type: 'EXPENSE', parentCode: '5000' },
]
