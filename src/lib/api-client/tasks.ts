import { apiRequest } from '@/lib/api-client/core'
import type { QueryParams } from '@/lib/api-client/types'

export type TaskSummary = {
  id: string
  title: string
  stage?: string
  priority?: string
  projectId?: string | null
  [key: string]: unknown
}

export type TaskInput = Record<string, unknown>

export const tasksApi = {
  list(params: QueryParams = {}) {
    return apiRequest<TaskSummary[]>('/api/tasks', { query: params })
  },
  create(input: TaskInput) {
    return apiRequest<TaskSummary, TaskInput>('/api/tasks', { body: input, method: 'POST', retries: 0 })
  },
  update(id: string, input: TaskInput) {
    return apiRequest<TaskSummary, TaskInput>(`/api/tasks/${encodeURIComponent(id)}`, {
      body: input,
      method: 'PATCH',
      retries: 0,
    })
  },
  delete(id: string) {
    return apiRequest<{ ok: true }>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE', retries: 0 })
  },
}
