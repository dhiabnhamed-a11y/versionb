import { apiRequest } from '@/lib/api-client/core'
import type { ContractLanguage, SerializedContract } from '@/lib/contracts'

export type ContractGenerationInput = {
  projectId?: string
  contractType?: string
  language?: ContractLanguage
  currency?: string
  governingLaw?: string
  jurisdiction?: string
  paymentFrequency?: string
  paymentTerms?: string
  confidentialityLevel?: string
  supportTerms?: string
  terminationNoticeDays?: number
  revisionLimit?: string
  ipOwnership?: string
  serviceScope?: string
  durationMonths?: number
  renewalTerms?: string
  riskProfile?: string
  effectiveDate?: string
  pricingStructure?: string
}

export type ClientContractsResponse = {
  items: SerializedContract[]
}

export type ContractGenerationResponse = {
  contract: SerializedContract
  jobId: string
  missingFields: string[]
  aiMessage: string
}

export const contractsApi = {
  listForClient(clientId: string) {
    return apiRequest<ClientContractsResponse>(`/api/clients/${encodeURIComponent(clientId)}/contracts`)
  },
  generateForClient(clientId: string, input: ContractGenerationInput) {
    return apiRequest<ContractGenerationResponse, ContractGenerationInput>(`/api/clients/${encodeURIComponent(clientId)}/contracts`, {
      method: 'POST',
      body: input,
      retries: 0,
    })
  },
}
