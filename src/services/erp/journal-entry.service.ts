import 'server-only'

import type { SessionUser } from '@/modules/shared/session'
import {
  createJournalEntry,
  getJournalEntry,
  listJournalEntries,
  postJournalEntry,
  reverseJournalEntry,
} from '@/modules/accounting/accounting.service'
import type { PaginationInput } from '@/modules/shared/pagination'
import { erpJournalEntrySchema, erpReverseJournalEntrySchema } from '@/services/erp/erp.validation'

export async function createErpJournalEntry(user: SessionUser, rawInput: unknown) {
  return createJournalEntry(user, erpJournalEntrySchema.parse(rawInput))
}

export async function listErpJournalEntries(user: SessionUser, pagination: PaginationInput) {
  return listJournalEntries(user, pagination)
}

export async function getErpJournalEntry(user: SessionUser, id: string) {
  return getJournalEntry(user, id)
}

export async function postErpJournalEntry(user: SessionUser, id: string) {
  return postJournalEntry(user, id)
}

export async function reverseErpJournalEntry(user: SessionUser, id: string, rawInput: unknown) {
  return reverseJournalEntry(user, id, erpReverseJournalEntrySchema.parse(rawInput))
}
