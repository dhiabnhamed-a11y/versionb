/**
 * HIPAA §164.530(j) — Documentation & Retention
 * Medical records: 6 years minimum from date of creation, or date last in effect.
 * EMS incident reports often governed by state law (some require 10+ years).
 */
import { prisma } from '@/lib/db'
import { logger } from '@/modules/shared/logger'

export type RetentionPolicy = {
  incidentRecords: number     // years — default 7 (federal: 6 + 1 buffer)
  patientRecords: number      // years — default 7
  auditLogs: number           // years — default 6 (HIPAA minimum)
  dispatchLogs: number        // years — default 7
  mediaFiles: number          // years — default 7
  communicationLogs: number   // years — default 3
}

const DEFAULT_POLICY: RetentionPolicy = {
  incidentRecords: 7,
  patientRecords: 7,
  auditLogs: 6,
  dispatchLogs: 7,
  mediaFiles: 7,
  communicationLogs: 3,
}

function yearsAgo(years: number): Date {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  return d
}

export async function runRetentionAudit(companyId: string, policy?: Partial<RetentionPolicy>): Promise<{
  expiredIncidents: number
  expiredPatients: number
  expiredAuditLogs: number
  expiredDispatchLogs: number
  expiredCommunications: number
}> {
  const p = { ...DEFAULT_POLICY, ...policy }

  const [incidents, patients, auditLogs, dispatchLogs, comms] = await Promise.all([
    prisma.emsIncident.count({ where: { companyId, completedAt: { lt: yearsAgo(p.incidentRecords) } } }),
    prisma.emsPatient.count({ where: { incident: { companyId, completedAt: { lt: yearsAgo(p.patientRecords) } } } }),
    prisma.emsAuditLog.count({ where: { companyId, timestamp: { lt: yearsAgo(p.auditLogs) } } }),
    prisma.emsDispatchLog.count({ where: { incident: { companyId, completedAt: { lt: yearsAgo(p.dispatchLogs) } } } }),
    prisma.emsCommunication.count({ where: { incident: { companyId, completedAt: { lt: yearsAgo(p.communicationLogs) } } } }),
  ])

  return {
    expiredIncidents: incidents,
    expiredPatients: patients,
    expiredAuditLogs: auditLogs,
    expiredDispatchLogs: dispatchLogs,
    expiredCommunications: comms,
  }
}

export async function purgeExpiredData(
  companyId: string,
  policy?: Partial<RetentionPolicy>,
  dryRun = true
): Promise<{ purged: Record<string, number>; dryRun: boolean }> {
  const p = { ...DEFAULT_POLICY, ...policy }
  const purged: Record<string, number> = {}

  logger.info('hipaa.retention.purge_start', { companyId, dryRun, policy: p })

  if (!dryRun) {
    // Delete communication transcripts (anonymize, not delete incident records)
    const commResult = await prisma.emsCommunication.updateMany({
      where: { incident: { companyId, completedAt: { lt: yearsAgo(p.communicationLogs) } }, transcript: { not: null } },
      data: { transcript: null, content: '[PURGED - retention policy]' },
    })
    purged.communicationTranscripts = commResult.count

    // Anonymize patient records (retain record structure, scrub PHI)
    const patientResult = await prisma.emsPatient.updateMany({
      where: { incident: { companyId, completedAt: { lt: yearsAgo(p.patientRecords) } } },
      data: {
        name: '[ANONYMIZED]',
        dateOfBirth: null,
        ssn: null,
        medicalHistory: null,
        medications: null,
        allergies: null,
        insuranceInfo: null,
      },
    })
    purged.patientsAnonymized = patientResult.count

    // Purge old audit logs (keep record count but scrub actor identifiers)
    const auditResult = await prisma.emsAuditLog.updateMany({
      where: { companyId, timestamp: { lt: yearsAgo(p.auditLogs) } },
      data: { ipAddress: null, metadata: {} },
    })
    purged.auditLogsScrubbed = auditResult.count

    logger.info('hipaa.retention.purge_complete', { companyId, purged })
  } else {
    const audit = await runRetentionAudit(companyId, policy)
    purged.expiredIncidents = audit.expiredIncidents
    purged.expiredPatients = audit.expiredPatients
    purged.expiredAuditLogs = audit.expiredAuditLogs
    purged.expiredCommunications = audit.expiredCommunications
  }

  return { purged, dryRun }
}

export function getRetentionDeadlines(policy?: Partial<RetentionPolicy>): Record<string, Date> {
  const p = { ...DEFAULT_POLICY, ...policy }
  return {
    incidentRecords: yearsAgo(p.incidentRecords),
    patientRecords: yearsAgo(p.patientRecords),
    auditLogs: yearsAgo(p.auditLogs),
    dispatchLogs: yearsAgo(p.dispatchLogs),
    mediaFiles: yearsAgo(p.mediaFiles),
    communicationLogs: yearsAgo(p.communicationLogs),
  }
}
