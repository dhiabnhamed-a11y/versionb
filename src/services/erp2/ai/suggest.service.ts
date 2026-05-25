import 'server-only'

import { prisma } from '@/lib/db'
import { suggestJournalEntry } from '@/services/erp2/ai/engine'

export type SuggestJournalEntryInput = {
  description: string
  amount?: number | null
  workspaceId: string
}

export async function suggestJournalEntryForWorkspace(input: SuggestJournalEntryInput) {
  const { description, workspaceId } = input
  const amountCents = input.amount ?? null

  // Try to find a vendor mapping first
  const lowerDesc = description.toLowerCase()
  const knownMappings = await prisma.eRPVendorCategoryMapping.findMany({
    where: { workspaceId },
    select: { vendorName: true, accountCode: true, confidence: true },
  })

  let vendorMappingAccountCode: string | null = null
  let vendorName: string | null = null

  for (const mapping of knownMappings) {
    if (lowerDesc.includes(mapping.vendorName)) {
      vendorMappingAccountCode = mapping.accountCode
      vendorName = mapping.vendorName
      break
    }
  }

  // Run the deterministic engine
  const engineResult = suggestJournalEntry(description, amountCents)

  // If vendor mapping exists, override with learned account
  if (vendorMappingAccountCode && engineResult.lines.length >= 2) {
    // Find the learned account in CoA for display name
    const coaAccount = await prisma.eRPAccount.findFirst({
      where: { workspaceId, code: vendorMappingAccountCode, isDeleted: false },
      select: { code: true, name: true },
    })

    if (coaAccount) {
      // Replace the expense/revenue line with the learned mapping
      const debitLine = engineResult.lines.find(l => l.side === 'debit')
      const creditLine = engineResult.lines.find(l => l.side === 'credit')

      // Preserve the bank side, replace the other side
      if (debitLine && engineResult.lines[0].accountCode !== DEFAULT_BANK_CODE) {
        engineResult.lines[0] = { ...debitLine, accountCode: coaAccount.code, accountName: coaAccount.name }
      } else if (creditLine && engineResult.lines[1].accountCode !== DEFAULT_BANK_CODE) {
        engineResult.lines[1] = { ...creditLine, accountCode: coaAccount.code, accountName: coaAccount.name }
      }

      // Boost confidence since we have a learned mapping
      engineResult.confidence = Math.min(100, engineResult.confidence + 15)
      engineResult.matchedVendor = vendorName ?? undefined
    }
  }

  return engineResult
}

const DEFAULT_BANK_CODE = '1010'
