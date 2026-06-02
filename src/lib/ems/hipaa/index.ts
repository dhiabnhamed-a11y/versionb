export { encryptPhi, decryptPhi, encryptPhiRecord, decryptPhiRecord, isEncrypted, generatePhiKey, PHI_PATIENT_FIELDS } from './phi-crypto'
export { logPhiAccess, withPhiAudit, getPhiAccessLog } from './audit-enforcer'
export type { PhiAccessContext, PhiResourceType } from './audit-enforcer'
export { runRetentionAudit, purgeExpiredData, getRetentionDeadlines } from './data-retention'
export type { RetentionPolicy } from './data-retention'

/**
 * HIPAA Compliance Technical Checklist
 *
 * IMPLEMENTED IN CODE:
 * ✅ PHI field-level AES-256-GCM encryption (phi-crypto.ts)
 * ✅ Audit logging on every PHI read/write (audit-enforcer.ts)
 * ✅ Data retention policy with automated purge (data-retention.ts)
 * ✅ Role-based access control (MANAGER+ for patient PHI)
 * ✅ Immutable audit log checksums (tamper detection)
 * ✅ Company-scoped data isolation (multi-tenant)
 * ✅ HTTPS only (Vercel enforced)
 * ✅ Input validation on all API endpoints (Zod)
 *
 * REQUIRES BUSINESS/LEGAL STEPS:
 * ⬜ BAA with Supabase — supabase.com/docs/guides/platform/hipaa
 *     → Requires Supabase Enterprise plan + signed BAA
 * ⬜ BAA with Vercel — vercel.com/docs/security/hipaa
 *     → Requires Vercel Enterprise + signed BAA
 * ⬜ BAA with Firebase — Google Cloud HIPAA BAA covers Firebase
 *     → enroll.cloud.google.com/hipaa
 * ⬜ Staff training on HIPAA policies (Privacy Rule, Security Rule)
 * ⬜ Risk Analysis & Risk Management (addressable safeguard)
 * ⬜ Workforce clearance procedures
 * ⬜ Disaster recovery plan
 * ⬜ Penetration test by certified firm
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * EMS_PHI_ENCRYPTION_KEY — 32-byte hex key (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
 */
