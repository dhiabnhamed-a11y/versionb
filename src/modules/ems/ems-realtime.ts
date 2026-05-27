import { emitCompanyRealtime } from '@/lib/realtime-server'
import { logger } from '@/modules/shared/logger'

export async function emitEmsEvent(
  companyId: string,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    emitCompanyRealtime(companyId, type as any, {
      ...payload,
      _meta: { emittedAt: new Date().toISOString(), type, companyId },
    })
  } catch (error) {
    logger.error('ems.emit_error', error, { type, companyId })
  }
}

export const EmsRooms = {
  command: (companyId: string) => `ems:${companyId}:command`,
  dispatch: (companyId: string) => `ems:${companyId}:dispatch`,
  incident: (companyId: string, incidentId: string) => `ems:${companyId}:incident:${incidentId}`,
  fleet: (companyId: string) => `ems:${companyId}:fleet`,
  hospital: (companyId: string, hospitalId: string) => `ems:${companyId}:hospital:${hospitalId}`,
}

export const EMS_EVENTS = {
  INCIDENT_CREATED: 'ems:incident:created',
  INCIDENT_UPDATED: 'ems:incident:updated',
  INCIDENT_STATUS_CHANGED: 'ems:incident:status_changed',
  UNIT_POSITION: 'ems:unit:position',
  UNIT_STATUS: 'ems:unit:status',
  UNIT_ASSIGNED: 'ems:unit:assigned',
  HOSPITAL_STATUS: 'ems:hospital:status',
  HOSPITAL_ALERT: 'ems:hospital:alert',
  DISPATCH_DECISION: 'ems:dispatch:decision',
  AI_INSIGHT: 'ems:ai:insight',
  PREDICTIVE_ALERT: 'ems:predictive:alert',
  SYSTEM_ALERT: 'ems:system:alert',
  WORKFLOW_TRIGGERED: 'ems:workflow:triggered',
} as const
