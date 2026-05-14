import { apiRequest } from '@/lib/api-client/core'
import type { QueryParams } from '@/lib/api-client/types'

export type InvoiceSummary = {
  id: string
  invoiceNumber: string
  status: string
  currency: string
  total: number | string
  createdAt?: string
  [key: string]: unknown
}

export type InvoicesResponse = {
  items: InvoiceSummary[]
  pagination: {
    page: number
    pageSize: number
    total: number
    pageCount: number
  }
  summary?: {
    total: number
    count: number
  }
}

export type InvoiceInput = Record<string, unknown>

export const invoicesApi = {
  list(params: QueryParams = {}) {
    return apiRequest<InvoicesResponse>('/api/invoices', { query: params })
  },
  get(id: string) {
    return apiRequest<InvoiceSummary>(`/api/invoices/${encodeURIComponent(id)}`)
  },
  create(input: InvoiceInput) {
    return apiRequest<InvoiceSummary, InvoiceInput>('/api/invoices', { body: input, method: 'POST', retries: 0 })
  },
  update(id: string, input: InvoiceInput) {
    return apiRequest<InvoiceSummary, InvoiceInput>(`/api/invoices/${encodeURIComponent(id)}`, {
      body: input,
      method: 'PATCH',
      retries: 0,
    })
  },
  delete(id: string, input: { confirmation?: unknown } = {}) {
    return apiRequest<{ ok: true }, { confirmation?: unknown }>(`/api/invoices/${encodeURIComponent(id)}`, {
      body: input,
      method: 'DELETE',
      retries: 0,
    })
  },
}
