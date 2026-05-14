import { apiRequest } from '@/lib/api-client/core'

const ALERTS_API_BASE = '/api/v1/alerts'

export type AlertRecord = {
  createdAt: string
  id: string
  message: string
  read: boolean
  sender?: {
    avatar?: string | null
    id: string
    name: string
  } | null
  title: string
  type: string
}

export type CreateAlertInput = {
  message: string
  recipientId: string
  title: string
  type?: string
}

export const alertsApi = {
  list() {
    return apiRequest<AlertRecord[]>(ALERTS_API_BASE)
  },
  create(input: CreateAlertInput) {
    return apiRequest<AlertRecord, CreateAlertInput>(ALERTS_API_BASE, {
      body: input,
      method: 'POST',
      retries: 0,
    })
  },
  markRead(alertId: string) {
    return apiRequest<AlertRecord, { alertId: string }>(ALERTS_API_BASE, {
      body: { alertId },
      method: 'PATCH',
      retries: 0,
    })
  },
}
