import { apiRequest } from '@/lib/api-client/core'
import type { QueryParams } from '@/lib/api-client/types'

const TASKS_API_BASE = '/api/v1/tasks'

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
    return apiRequest<TaskSummary[]>(TASKS_API_BASE, { query: params })
  },
  create(input: TaskInput) {
    return apiRequest<TaskSummary, TaskInput>(TASKS_API_BASE, { body: input, method: 'POST', retries: 0 })
  },
  update(id: string, input: TaskInput) {
    return apiRequest<TaskSummary, TaskInput>(`${TASKS_API_BASE}/${encodeURIComponent(id)}`, {
      body: input,
      method: 'PATCH',
      retries: 0,
    })
  },
  delete(id: string) {
    return apiRequest<{ success: true }>(`${TASKS_API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE', retries: 0 })
  },
}
