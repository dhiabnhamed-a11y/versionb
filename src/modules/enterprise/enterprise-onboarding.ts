import type { Prisma } from '@prisma/client'
import { isEnterpriseOperationsCompanyType, type CompanyType } from '@/lib/company-types'

type ProvisionEnterpriseWorkspaceInput = {
  companyId: string
  ownerId: string
  companyType: CompanyType
}

const COMMON_DEPARTMENTS = [
  { name: 'IT', code: 'IT', workloadTarget: 85 },
  { name: 'HR', code: 'HR', workloadTarget: 70 },
  { name: 'Finance', code: 'FIN', workloadTarget: 75 },
  { name: 'Operations', code: 'OPS', workloadTarget: 85 },
  { name: 'Facilities', code: 'FAC', workloadTarget: 80 },
  { name: 'Security', code: 'SEC', workloadTarget: 80 },
  { name: 'Procurement', code: 'PROC', workloadTarget: 75 },
  { name: 'Compliance', code: 'COMP', workloadTarget: 70 },
  { name: 'Administration', code: 'ADMIN', workloadTarget: 70 },
] as const

const HEALTHCARE_DEPARTMENTS = [
  { name: 'Biomedical', code: 'BIO', workloadTarget: 80 },
  { name: 'Nursing', code: 'NUR', workloadTarget: 85 },
  { name: 'Medical Operations', code: 'MEDOPS', workloadTarget: 85 },
  { name: 'Laboratory', code: 'LAB', workloadTarget: 80 },
] as const

const CORPORATE_IT_DEPARTMENTS = [
  { name: 'Infrastructure', code: 'INFRA', workloadTarget: 85 },
  { name: 'Service Desk', code: 'SD', workloadTarget: 90 },
  { name: 'Network Operations', code: 'NOC', workloadTarget: 85 },
] as const

const ASSET_CATEGORIES = [
  { name: 'Medical devices', code: 'MEDICAL_DEVICE', assetType: 'MEDICAL_DEVICE', riskWeight: 90, maintenanceDays: 30 },
  { name: 'IT equipment', code: 'IT_EQUIPMENT', assetType: 'IT_EQUIPMENT', riskWeight: 55, maintenanceDays: 180 },
  { name: 'Servers', code: 'SERVER', assetType: 'SERVER', riskWeight: 85, maintenanceDays: 30 },
  { name: 'Printers', code: 'PRINTER', assetType: 'PRINTER', riskWeight: 35, maintenanceDays: 120 },
  { name: 'Network devices', code: 'NETWORK_DEVICE', assetType: 'NETWORK_DEVICE', riskWeight: 80, maintenanceDays: 60 },
  { name: 'Ambulances', code: 'AMBULANCE', assetType: 'AMBULANCE', riskWeight: 95, maintenanceDays: 30 },
  { name: 'Cameras', code: 'CAMERA', assetType: 'CAMERA', riskWeight: 60, maintenanceDays: 90 },
  { name: 'Laboratory devices', code: 'LAB_DEVICE', assetType: 'LAB_DEVICE', riskWeight: 88, maintenanceDays: 30 },
  { name: 'HVAC', code: 'HVAC', assetType: 'HVAC', riskWeight: 70, maintenanceDays: 60 },
  { name: 'Security systems', code: 'SECURITY_SYSTEM', assetType: 'SECURITY_SYSTEM', riskWeight: 82, maintenanceDays: 45 },
  { name: 'Tablets', code: 'TABLET', assetType: 'TABLET', riskWeight: 45, maintenanceDays: 180 },
  { name: 'Monitors', code: 'MONITOR', assetType: 'MONITOR', riskWeight: 25, maintenanceDays: 365 },
  { name: 'Inventory assets', code: 'INVENTORY', assetType: 'INVENTORY', riskWeight: 40, maintenanceDays: 90 },
] as const

const SLA_POLICIES = [
  { name: 'P1 Critical outage', priority: 'P1', severity: 'CRITICAL', responseMinutes: 15, resolutionMinutes: 240, escalationAfterMinutes: 30 },
  { name: 'P2 High impact', priority: 'P2', severity: 'HIGH', responseMinutes: 30, resolutionMinutes: 480, escalationAfterMinutes: 60 },
  { name: 'P3 Standard operations', priority: 'P3', severity: 'MEDIUM', responseMinutes: 120, resolutionMinutes: 1440, escalationAfterMinutes: 240 },
  { name: 'P4 Low impact request', priority: 'P4', severity: 'LOW', responseMinutes: 480, resolutionMinutes: 4320, escalationAfterMinutes: 1440 },
] as const

const APPROVAL_WORKFLOWS = [
  {
    name: 'High-risk asset replacement',
    scope: 'ASSET',
    trigger: 'asset.replacement_requested',
    steps: [
      { role: 'Facility Manager', action: 'REVIEW_OPERATIONAL_NEED' },
      { role: 'Finance Manager', action: 'APPROVE_BUDGET' },
      { role: 'Compliance Officer', action: 'VERIFY_RISK_AND_EVIDENCE' },
    ],
  },
  {
    name: 'Critical incident escalation',
    scope: 'INCIDENT',
    trigger: 'incident.priority_p1_created',
    steps: [
      { role: 'Operations Manager', action: 'ACKNOWLEDGE' },
      { role: 'Security Officer', action: 'ASSESS_SECURITY_IMPACT' },
      { role: 'Compliance Officer', action: 'ASSESS_REGULATORY_IMPACT' },
    ],
  },
] as const

const COMPLIANCE_CONTROLS = [
  {
    name: 'Asset maintenance evidence',
    framework: 'TASKIT-OPS',
    controlCode: 'OPS-AM-001',
    ownerRole: 'Facility Manager',
    riskLevel: 'HIGH',
    evidenceRequirements: ['maintenance_report', 'technician_identity', 'asset_health_before_after'],
  },
  {
    name: 'Incident resolution audit trail',
    framework: 'TASKIT-OPS',
    controlCode: 'OPS-IM-001',
    ownerRole: 'Compliance Officer',
    riskLevel: 'HIGH',
    evidenceRequirements: ['root_cause', 'resolution_summary', 'sla_timestamps', 'approvals'],
  },
  {
    name: 'Quarterly access review',
    framework: 'TASKIT-SEC',
    controlCode: 'SEC-AR-001',
    ownerRole: 'Security Officer',
    riskLevel: 'MEDIUM',
    evidenceRequirements: ['user_role_export', 'department_manager_attestation', 'exceptions'],
  },
] as const

function enterpriseDepartmentsFor(type: CompanyType) {
  if (type === 'CORPORATE_IT_OPERATIONS') return [...COMMON_DEPARTMENTS, ...CORPORATE_IT_DEPARTMENTS]
  if (type === 'HEALTHCARE' || type === 'CLINIC_HOSPITAL') return [...COMMON_DEPARTMENTS, ...HEALTHCARE_DEPARTMENTS]
  return COMMON_DEPARTMENTS
}

function defaultPermissionSet(role: string) {
  const normalized = role.toUpperCase()
  return {
    asset: ['OWNER', 'ADMINISTRATOR', 'FACILITY_MANAGER', 'BIOMEDICAL_ENGINEER', 'IT_ADMINISTRATOR'].includes(normalized)
      ? ['create', 'read', 'update', 'audit']
      : ['read'],
    incident: ['OWNER', 'ADMINISTRATOR', 'OPERATIONS_MANAGER', 'TEAM_LEAD', 'TECHNICIAN'].includes(normalized)
      ? ['create', 'read', 'update', 'resolve']
      : ['read'],
    maintenance: ['OWNER', 'ADMINISTRATOR', 'FACILITY_MANAGER', 'BIOMEDICAL_ENGINEER', 'TECHNICIAN'].includes(normalized)
      ? ['create', 'read', 'update', 'complete']
      : ['read'],
    compliance: ['OWNER', 'ADMINISTRATOR', 'COMPLIANCE_OFFICER', 'AUDITOR'].includes(normalized) ? ['read', 'export', 'review'] : ['read'],
    audit: ['OWNER', 'ADMINISTRATOR', 'COMPLIANCE_OFFICER', 'AUDITOR'].includes(normalized) ? ['read', 'export'] : [],
  }
}

export async function provisionEnterpriseOperationsWorkspace(
  tx: Prisma.TransactionClient,
  input: ProvisionEnterpriseWorkspaceInput
) {
  if (!isEnterpriseOperationsCompanyType(input.companyType)) {
    return { provisioned: false as const }
  }

  const departments = await Promise.all(
    enterpriseDepartmentsFor(input.companyType).map((department) =>
      tx.enterpriseDepartment.create({
        data: {
          companyId: input.companyId,
          managerId: input.ownerId,
          name: department.name,
          code: department.code,
          workloadTarget: department.workloadTarget,
          slaOwnership: { ownsResponse: true, ownsResolution: true },
          approvalChain: [{ role: 'Department Manager' }, { role: 'Operations Manager' }],
          escalationRules: { p1: ['Team Lead', 'Operations Manager'], p2: ['Team Lead'] },
          shiftPolicy: { model: 'ROTATING', handoffRequired: true },
        },
      })
    )
  )

  const departmentsByCode = new Map(departments.map((department) => [department.code, department]))
  const primaryOpsDepartment = departmentsByCode.get('OPS') ?? departments[0]
  const primaryItDepartment = departmentsByCode.get('SD') ?? departmentsByCode.get('IT') ?? primaryOpsDepartment
  const biomedicalDepartment = departmentsByCode.get('BIO') ?? primaryOpsDepartment

  const teams = await Promise.all([
    tx.enterpriseTeam.create({
      data: {
        companyId: input.companyId,
        departmentId: primaryOpsDepartment.id,
        leaderId: input.ownerId,
        name: 'Operations Command Queue',
        code: 'OPS-COMMAND',
        queueKey: 'ops.command',
        workloadCapacity: 120,
        escalationChain: [{ afterMinutes: 30, role: 'Operations Manager' }, { afterMinutes: 60, role: 'Owner' }],
      },
    }),
    tx.enterpriseTeam.create({
      data: {
        companyId: input.companyId,
        departmentId: primaryItDepartment.id,
        leaderId: input.ownerId,
        name: 'Service Desk Queue',
        code: 'SERVICE-DESK',
        queueKey: 'service.desk',
        workloadCapacity: 160,
        shiftSchedule: { coverage: 'business-hours', handoff: true },
        escalationChain: [{ afterMinutes: 60, role: 'Team Lead' }, { afterMinutes: 120, role: 'IT Administrator' }],
      },
    }),
    tx.enterpriseTeam.create({
      data: {
        companyId: input.companyId,
        departmentId: biomedicalDepartment.id,
        leaderId: input.ownerId,
        name: input.companyType === 'CORPORATE_IT_OPERATIONS' ? 'Infrastructure Reliability Queue' : 'Biomedical Response Queue',
        code: input.companyType === 'CORPORATE_IT_OPERATIONS' ? 'INFRA-RELIABILITY' : 'BIOMED-RESPONSE',
        queueKey: input.companyType === 'CORPORATE_IT_OPERATIONS' ? 'infra.reliability' : 'biomed.response',
        workloadCapacity: 100,
        escalationChain: [{ afterMinutes: 30, role: 'Team Lead' }, { afterMinutes: 90, role: 'Compliance Officer' }],
      },
    }),
  ])

  await Promise.all(
    teams.map((team) =>
      tx.enterpriseTeamMember.create({
        data: {
          companyId: input.companyId,
          teamId: team.id,
          userId: input.ownerId,
          role: 'TEAM_LEAD',
          isOnCall: team.code === 'OPS-COMMAND',
          capacity: 100,
          shiftName: 'Primary',
        },
      })
    )
  )

  await Promise.all(
    ASSET_CATEGORIES.map((category) =>
      tx.enterpriseAssetCategory.create({
        data: {
          companyId: input.companyId,
          name: category.name,
          code: category.code,
          assetType: category.assetType,
          riskWeight: category.riskWeight,
          maintenanceTemplate: {
            defaultFrequencyDays: category.maintenanceDays,
            requiresCompletionReport: true,
            overdueAlert: true,
          },
          complianceProfile: { auditRequired: category.riskWeight >= 70, healthScoreTracked: true },
          lifecyclePolicy: { states: ['PLANNED', 'IN_SERVICE', 'MAINTENANCE', 'RETIRED'], depreciationTracked: true },
        },
      })
    )
  )

  await Promise.all(
    SLA_POLICIES.map((policy) =>
      tx.enterpriseSlaPolicy.create({
        data: {
          companyId: input.companyId,
          departmentId: primaryOpsDepartment.id,
          name: policy.name,
          priority: policy.priority,
          severity: policy.severity,
          responseMinutes: policy.responseMinutes,
          resolutionMinutes: policy.resolutionMinutes,
          escalationAfterMinutes: policy.escalationAfterMinutes,
          defaultPolicy: policy.priority === 'P3',
          escalationChain: [{ role: 'Team Lead' }, { role: 'Operations Manager' }, { role: 'Owner' }],
          breachActions: { notify: ['assignedTeam', 'departmentManager'], createAuditEvent: true },
        },
      })
    )
  )

  await Promise.all(
    APPROVAL_WORKFLOWS.map((workflow) =>
      tx.enterpriseApprovalWorkflow.create({
        data: {
          companyId: input.companyId,
          departmentId: primaryOpsDepartment.id,
          createdById: input.ownerId,
          name: workflow.name,
          scope: workflow.scope,
          trigger: workflow.trigger,
          steps: workflow.steps,
          escalation: { breachMinutes: 1440, notifyRole: 'Owner' },
        },
      })
    )
  )

  await Promise.all(
    COMPLIANCE_CONTROLS.map((control) =>
      tx.enterpriseComplianceControl.create({
        data: {
          companyId: input.companyId,
          departmentId: departmentsByCode.get('COMP')?.id,
          name: control.name,
          framework: control.framework,
          controlCode: control.controlCode,
          ownerRole: control.ownerRole,
          riskLevel: control.riskLevel,
          evidenceRequirements: control.evidenceRequirements,
          reviewFrequencyDays: 90,
          nextReviewAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      })
    )
  )

  await tx.enterpriseRoleAssignment.create({
    data: {
      companyId: input.companyId,
      userId: input.ownerId,
      role: 'OWNER',
      scope: 'COMPANY',
      permissionSet: defaultPermissionSet('OWNER'),
    },
  })

  await tx.enterpriseAuditEvent.create({
    data: {
      companyId: input.companyId,
      actorId: input.ownerId,
      action: 'enterprise.workspace_provisioned',
      entityType: 'company',
      entityId: input.companyId,
      after: {
        companyType: input.companyType,
        departments: departments.length,
        assetCategories: ASSET_CATEGORIES.length,
        slaPolicies: SLA_POLICIES.length,
      },
      metadata: { source: 'signup_onboarding' },
    },
  })

  return { provisioned: true as const, departmentCount: departments.length }
}
