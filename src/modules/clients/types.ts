export type { BillingSessionUser } from '@/lib/clients'

export type ClientCreateBody = {
  companyName?: unknown
  contactPerson?: unknown
  email?: unknown
  phone?: unknown
  country?: unknown
  address?: unknown
  notes?: unknown
  avatarUrl?: unknown
  status?: unknown
}

export type ClientPatchBody = Partial<ClientCreateBody>
