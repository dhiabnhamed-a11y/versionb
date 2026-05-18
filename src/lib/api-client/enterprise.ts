import { apiRequest } from '@/lib/api-client/core'

export type EnterpriseIncident = {
  id: string
  incidentNumber: string
  title: string
  description?: string | null
  type: string
  priority: string
  severity: string
  status: string
  createdAt: string
  department?: { name: string } | null
  asset?: { name: string } | null
  assignedTeam?: { name: string } | null
}

export type CreateIncidentInput = {
  title: string
  description?: string
  type: string
  priority?: string
  severity?: string
  impact?: string
  urgency?: string
  source?: string
}

export const enterpriseApi = {
  listIncidents() {
    return apiRequest<EnterpriseIncident[]>('/api/enterprise/incidents')
  },
  createIncident(input: CreateIncidentInput) {
    return apiRequest<EnterpriseIncident, CreateIncidentInput>('/api/enterprise/incidents', {
      method: 'POST',
      body: input,
      retries: 0,
    })
  },
  updateIncident(id: string, input: Record<string, unknown>) {
    return apiRequest<EnterpriseIncident, Record<string, unknown>>(`/api/enterprise/incidents/${id}`, {
      method: 'PATCH',
      body: input,
      retries: 0,
    })
  },
}
