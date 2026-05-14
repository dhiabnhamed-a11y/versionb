import { apiRequest } from '@/lib/api-client/core'
import type { QueryParams } from '@/lib/api-client/types'

export type ProjectSummary = {
  id: string
  title: string
  description?: string | null
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

export type ProjectInput = Record<string, unknown>

export const projectsApi = {
  list(params: QueryParams = {}) {
    return apiRequest<ProjectSummary[]>('/api/projects', { query: params })
  },
  get(id: string) {
    return apiRequest<ProjectSummary>(`/api/projects/${encodeURIComponent(id)}`)
  },
  create(input: ProjectInput) {
    return apiRequest<ProjectSummary, ProjectInput>('/api/projects', { body: input, method: 'POST', retries: 0 })
  },
  update(id: string, input: ProjectInput) {
    return apiRequest<ProjectSummary, ProjectInput>(`/api/projects/${encodeURIComponent(id)}`, {
      body: input,
      method: 'PATCH',
      retries: 0,
    })
  },
  delete(id: string) {
    return apiRequest<{ ok: true }>(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE', retries: 0 })
  },
}
