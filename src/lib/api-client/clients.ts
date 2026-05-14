import { apiRequest } from '@/lib/api-client/core'

export type ClientStatus = 'active' | 'inactive'

export type Client = {
  id: string
  companyName: string
  contactPerson?: string | null
  email?: string | null
  phone?: string | null
  country?: string | null
  address?: string | null
  notes?: string | null
  avatarUrl?: string | null
  status: ClientStatus
  createdAt: string
  updatedAt: string
  unpaidTotal?: number
  _count?: {
    projects: number
    invoices: number
  }
}

export type ClientsResponse = {
  items: Client[]
  pagination: {
    page: number
    pageSize: number
    total: number
    pageCount: number
  }
  summary: {
    activeCount: number
    inactiveCount: number
    unpaidTotal: number
  }
}

export type ClientProfileResponse = {
  client: Client & {
    projects: Array<{
      id: string
      title: string
      description?: string | null
      category?: { id: string; name: string } | null
      manager?: { id: string; name: string } | null
      tasks: Array<{ id: string; stage: string }>
      updatedAt: string
    }>
    invoices: Array<{
      id: string
      invoiceNumber: string
      status: string
      currency: string
      dueDate?: string | null
      total: number | string
      campaign?: { id: string; title: string } | null
      brief?: { id: string; title: string } | null
      createdAt: string
    }>
    activities: Array<{
      id: string
      type: string
      title: string
      body?: string | null
      createdAt: string
      actor?: { id: string; name: string; email: string } | null
    }>
    _count: { projects: number; invoices: number }
  }
  stats: {
    activeProjects: number
    completedProjects: number
    unpaidInvoiceCount: number
    unpaidTotal: number
  }
  recentDeliverables: Array<{
    id: string
    type: string
    originalFilename: string
    thumbnailUrl?: string | null
    url: string
    createdAt: string
    uploadedBy: { id: string; name: string }
  }>
}

export type ClientInput = {
  companyName: string
  contactPerson?: string
  email?: string
  phone?: string
  country?: string
  address?: string
  notes?: string
  avatarUrl?: string
  status?: ClientStatus
}

export type ClientListParams = {
  page?: number
  pageSize?: number
  q?: string
  status?: ClientStatus
}

export const clientsApi = {
  list(params: ClientListParams = {}) {
    return apiRequest<ClientsResponse>('/api/clients', { query: params })
  },
  listFromUrl(url: string) {
    return apiRequest<ClientsResponse>(url)
  },
  get(id: string) {
    return apiRequest<ClientProfileResponse>(`/api/clients/${encodeURIComponent(id)}`)
  },
  getFromUrl(url: string) {
    return apiRequest<ClientProfileResponse>(url)
  },
  create(input: ClientInput) {
    return apiRequest<Client, ClientInput>('/api/clients', { body: input, method: 'POST', retries: 0 })
  },
  update(id: string, input: Partial<ClientInput>) {
    return apiRequest<Client, Partial<ClientInput>>(`/api/clients/${encodeURIComponent(id)}`, {
      body: input,
      method: 'PATCH',
      retries: 0,
    })
  },
  delete(id: string) {
    return apiRequest<{ ok: true }>(`/api/clients/${encodeURIComponent(id)}`, { method: 'DELETE', retries: 0 })
  },
  createPortal(id: string, input: { enabled: boolean; rotate?: boolean }) {
    return apiRequest<{ url: string }, { enabled: boolean; rotate?: boolean }>(`/api/clients/${encodeURIComponent(id)}/portal`, {
      body: input,
      method: 'POST',
      retries: 0,
    })
  },
}
