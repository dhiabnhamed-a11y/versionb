ALTER TABLE "Task" ADD COLUMN "enterpriseAssignedTeamId" TEXT;
ALTER TABLE "Task" ADD COLUMN "enterpriseDepartmentId" TEXT;
ALTER TABLE "Task" ADD COLUMN "enterpriseQueuePriority" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Task" ADD COLUMN "enterpriseSlaDueAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "enterpriseEscalationState" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Task" ADD COLUMN "enterpriseApprovalState" TEXT NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "Task" ADD COLUMN "enterpriseCheckpoints" JSONB;

CREATE TABLE "EnterpriseDepartment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "parentDepartmentId" TEXT,
  "managerId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "slaOwnership" JSONB,
  "approvalChain" JSONB,
  "escalationRules" JSONB,
  "shiftPolicy" JSONB,
  "workloadTarget" INTEGER NOT NULL DEFAULT 0,
  "performanceConfig" JSONB,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseTeam" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "parentTeamId" TEXT,
  "leaderId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "queueKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "rotationPolicy" JSONB,
  "shiftSchedule" JSONB,
  "escalationChain" JSONB,
  "workloadCapacity" INTEGER NOT NULL DEFAULT 0,
  "queueStrategy" TEXT NOT NULL DEFAULT 'PRIORITY_THEN_OLDEST',
  "metadata" JSONB,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseTeamMember" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'TECHNICIAN',
  "rotationGroup" TEXT,
  "shiftName" TEXT,
  "isOnCall" BOOLEAN NOT NULL DEFAULT false,
  "capacity" INTEGER NOT NULL DEFAULT 100,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseTaskAssignment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "departmentId" TEXT,
  "teamId" TEXT,
  "memberId" TEXT,
  "role" TEXT NOT NULL DEFAULT 'RESPONSIBLE',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "EnterpriseTaskAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseSlaPolicy" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "departmentId" TEXT,
  "name" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'INCIDENT',
  "priority" TEXT NOT NULL DEFAULT 'P3',
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "responseMinutes" INTEGER NOT NULL DEFAULT 60,
  "resolutionMinutes" INTEGER NOT NULL DEFAULT 480,
  "escalationAfterMinutes" INTEGER NOT NULL DEFAULT 120,
  "businessHoursOnly" BOOLEAN NOT NULL DEFAULT false,
  "escalationChain" JSONB,
  "breachActions" JSONB,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "defaultPolicy" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseSlaPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseAssetCategory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "riskWeight" INTEGER NOT NULL DEFAULT 50,
  "maintenanceTemplate" JSONB,
  "complianceProfile" JSONB,
  "lifecyclePolicy" JSONB,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseAssetCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseAsset" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "departmentId" TEXT,
  "assignedTeamId" TEXT,
  "assignedUserId" TEXT,
  "name" TEXT NOT NULL,
  "assetTag" TEXT NOT NULL,
  "qrCode" TEXT,
  "barcode" TEXT,
  "serialNumber" TEXT,
  "vendor" TEXT,
  "location" TEXT,
  "warrantyExpiresAt" TIMESTAMP(3),
  "purchaseDate" TIMESTAMP(3),
  "purchaseCost" DECIMAL(14,2),
  "depreciationMethod" TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
  "depreciationStartDate" TIMESTAMP(3),
  "depreciationMonths" INTEGER,
  "healthScore" INTEGER NOT NULL DEFAULT 100,
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "lifecycleState" TEXT NOT NULL DEFAULT 'IN_SERVICE',
  "operationalStatus" TEXT NOT NULL DEFAULT 'OPERATIONAL',
  "lastMaintenanceAt" TIMESTAMP(3),
  "nextMaintenanceAt" TIMESTAMP(3),
  "metadata" JSONB,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseIncident" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "incidentNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'P3',
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "impact" TEXT NOT NULL DEFAULT 'MEDIUM',
  "urgency" TEXT NOT NULL DEFAULT 'MEDIUM',
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "departmentId" TEXT,
  "assignedTeamId" TEXT,
  "reportedById" TEXT,
  "assignedToId" TEXT,
  "assetId" TEXT,
  "slaPolicyId" TEXT,
  "responseDueAt" TIMESTAMP(3),
  "resolutionDueAt" TIMESTAMP(3),
  "firstRespondedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "rootCause" TEXT,
  "resolution" TEXT,
  "escalationState" TEXT NOT NULL DEFAULT 'NONE',
  "approvalState" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "auditTrail" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseMaintenancePlan" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "assetId" TEXT,
  "assetCategoryId" TEXT,
  "departmentId" TEXT,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'PREVENTIVE',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "frequencyDays" INTEGER NOT NULL DEFAULT 30,
  "estimatedDurationMinutes" INTEGER NOT NULL DEFAULT 60,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "instructions" TEXT,
  "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseMaintenancePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseMaintenanceWorkOrder" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "workOrderNumber" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'PREVENTIVE',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'P3',
  "assetId" TEXT,
  "planId" TEXT,
  "incidentId" TEXT,
  "departmentId" TEXT,
  "assignedTeamId" TEXT,
  "assignedTechnicianId" TEXT,
  "scheduledFor" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completionReport" JSONB,
  "cost" DECIMAL(14,2),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseMaintenanceWorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseComplianceControl" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "departmentId" TEXT,
  "name" TEXT NOT NULL,
  "framework" TEXT NOT NULL,
  "controlCode" TEXT NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "evidenceRequirements" JSONB,
  "reviewFrequencyDays" INTEGER NOT NULL DEFAULT 90,
  "lastReviewedAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseComplianceControl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseApprovalWorkflow" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "departmentId" TEXT,
  "createdById" TEXT,
  "name" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "steps" JSONB NOT NULL,
  "escalation" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseRoleAssignment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "departmentId" TEXT,
  "teamId" TEXT,
  "role" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'COMPANY',
  "permissionSet" JSONB NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseAuditEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "deviceFingerprint" TEXT,
  "hash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnterpriseDepartment_companyId_code_key" ON "EnterpriseDepartment"("companyId", "code");
CREATE UNIQUE INDEX "EnterpriseDepartment_companyId_name_key" ON "EnterpriseDepartment"("companyId", "name");
CREATE INDEX "EnterpriseDepartment_companyId_status_createdAt_idx" ON "EnterpriseDepartment"("companyId", "status", "createdAt");
CREATE INDEX "EnterpriseDepartment_managerId_status_idx" ON "EnterpriseDepartment"("managerId", "status");
CREATE INDEX "EnterpriseDepartment_parentDepartmentId_idx" ON "EnterpriseDepartment"("parentDepartmentId");

CREATE UNIQUE INDEX "EnterpriseTeam_companyId_code_key" ON "EnterpriseTeam"("companyId", "code");
CREATE UNIQUE INDEX "EnterpriseTeam_companyId_queueKey_key" ON "EnterpriseTeam"("companyId", "queueKey");
CREATE INDEX "EnterpriseTeam_companyId_departmentId_status_idx" ON "EnterpriseTeam"("companyId", "departmentId", "status");
CREATE INDEX "EnterpriseTeam_leaderId_status_idx" ON "EnterpriseTeam"("leaderId", "status");
CREATE INDEX "EnterpriseTeam_parentTeamId_idx" ON "EnterpriseTeam"("parentTeamId");

CREATE UNIQUE INDEX "EnterpriseTeamMember_companyId_teamId_userId_key" ON "EnterpriseTeamMember"("companyId", "teamId", "userId");
CREATE INDEX "EnterpriseTeamMember_companyId_userId_role_idx" ON "EnterpriseTeamMember"("companyId", "userId", "role");
CREATE INDEX "EnterpriseTeamMember_teamId_isOnCall_shiftName_idx" ON "EnterpriseTeamMember"("teamId", "isOnCall", "shiftName");

CREATE INDEX "EnterpriseTaskAssignment_companyId_status_assignedAt_idx" ON "EnterpriseTaskAssignment"("companyId", "status", "assignedAt");
CREATE INDEX "EnterpriseTaskAssignment_taskId_status_idx" ON "EnterpriseTaskAssignment"("taskId", "status");
CREATE INDEX "EnterpriseTaskAssignment_teamId_status_assignedAt_idx" ON "EnterpriseTaskAssignment"("teamId", "status", "assignedAt");
CREATE INDEX "EnterpriseTaskAssignment_memberId_status_assignedAt_idx" ON "EnterpriseTaskAssignment"("memberId", "status", "assignedAt");

CREATE UNIQUE INDEX "EnterpriseSlaPolicy_companyId_name_key" ON "EnterpriseSlaPolicy"("companyId", "name");
CREATE INDEX "EnterpriseSlaPolicy_companyId_scope_priority_severity_status_idx" ON "EnterpriseSlaPolicy"("companyId", "scope", "priority", "severity", "status");
CREATE INDEX "EnterpriseSlaPolicy_departmentId_status_idx" ON "EnterpriseSlaPolicy"("departmentId", "status");

CREATE UNIQUE INDEX "EnterpriseAssetCategory_companyId_code_key" ON "EnterpriseAssetCategory"("companyId", "code");
CREATE UNIQUE INDEX "EnterpriseAssetCategory_companyId_name_key" ON "EnterpriseAssetCategory"("companyId", "name");
CREATE INDEX "EnterpriseAssetCategory_companyId_assetType_status_idx" ON "EnterpriseAssetCategory"("companyId", "assetType", "status");

CREATE UNIQUE INDEX "EnterpriseAsset_companyId_assetTag_key" ON "EnterpriseAsset"("companyId", "assetTag");
CREATE UNIQUE INDEX "EnterpriseAsset_companyId_serialNumber_key" ON "EnterpriseAsset"("companyId", "serialNumber");
CREATE INDEX "EnterpriseAsset_companyId_lifecycleState_operationalStatus_idx" ON "EnterpriseAsset"("companyId", "lifecycleState", "operationalStatus");
CREATE INDEX "EnterpriseAsset_companyId_healthScore_riskScore_idx" ON "EnterpriseAsset"("companyId", "healthScore", "riskScore");
CREATE INDEX "EnterpriseAsset_companyId_nextMaintenanceAt_idx" ON "EnterpriseAsset"("companyId", "nextMaintenanceAt");
CREATE INDEX "EnterpriseAsset_departmentId_operationalStatus_idx" ON "EnterpriseAsset"("departmentId", "operationalStatus");
CREATE INDEX "EnterpriseAsset_assignedUserId_lifecycleState_idx" ON "EnterpriseAsset"("assignedUserId", "lifecycleState");

CREATE UNIQUE INDEX "EnterpriseIncident_companyId_incidentNumber_key" ON "EnterpriseIncident"("companyId", "incidentNumber");
CREATE INDEX "EnterpriseIncident_companyId_status_priority_createdAt_idx" ON "EnterpriseIncident"("companyId", "status", "priority", "createdAt");
CREATE INDEX "EnterpriseIncident_companyId_severity_resolutionDueAt_idx" ON "EnterpriseIncident"("companyId", "severity", "resolutionDueAt");
CREATE INDEX "EnterpriseIncident_departmentId_status_createdAt_idx" ON "EnterpriseIncident"("departmentId", "status", "createdAt");
CREATE INDEX "EnterpriseIncident_assignedTeamId_status_priority_idx" ON "EnterpriseIncident"("assignedTeamId", "status", "priority");
CREATE INDEX "EnterpriseIncident_assetId_createdAt_idx" ON "EnterpriseIncident"("assetId", "createdAt");

CREATE INDEX "EnterpriseMaintenancePlan_companyId_status_nextRunAt_idx" ON "EnterpriseMaintenancePlan"("companyId", "status", "nextRunAt");
CREATE INDEX "EnterpriseMaintenancePlan_assetId_status_nextRunAt_idx" ON "EnterpriseMaintenancePlan"("assetId", "status", "nextRunAt");
CREATE INDEX "EnterpriseMaintenancePlan_assetCategoryId_status_idx" ON "EnterpriseMaintenancePlan"("assetCategoryId", "status");
CREATE INDEX "EnterpriseMaintenancePlan_departmentId_status_idx" ON "EnterpriseMaintenancePlan"("departmentId", "status");

CREATE UNIQUE INDEX "EnterpriseMaintenanceWorkOrder_companyId_workOrderNumber_key" ON "EnterpriseMaintenanceWorkOrder"("companyId", "workOrderNumber");
CREATE INDEX "EnterpriseMaintenanceWorkOrder_companyId_status_priority_dueAt_idx" ON "EnterpriseMaintenanceWorkOrder"("companyId", "status", "priority", "dueAt");
CREATE INDEX "EnterpriseMaintenanceWorkOrder_assetId_status_dueAt_idx" ON "EnterpriseMaintenanceWorkOrder"("assetId", "status", "dueAt");
CREATE INDEX "EnterpriseMaintenanceWorkOrder_assignedTeamId_status_dueAt_idx" ON "EnterpriseMaintenanceWorkOrder"("assignedTeamId", "status", "dueAt");
CREATE INDEX "EnterpriseMaintenanceWorkOrder_assignedTechnicianId_status_dueAt_idx" ON "EnterpriseMaintenanceWorkOrder"("assignedTechnicianId", "status", "dueAt");

CREATE UNIQUE INDEX "EnterpriseComplianceControl_companyId_framework_controlCode_key" ON "EnterpriseComplianceControl"("companyId", "framework", "controlCode");
CREATE INDEX "EnterpriseComplianceControl_companyId_status_riskLevel_nextReviewAt_idx" ON "EnterpriseComplianceControl"("companyId", "status", "riskLevel", "nextReviewAt");
CREATE INDEX "EnterpriseComplianceControl_departmentId_status_nextReviewAt_idx" ON "EnterpriseComplianceControl"("departmentId", "status", "nextReviewAt");

CREATE UNIQUE INDEX "EnterpriseApprovalWorkflow_companyId_name_key" ON "EnterpriseApprovalWorkflow"("companyId", "name");
CREATE INDEX "EnterpriseApprovalWorkflow_companyId_scope_status_idx" ON "EnterpriseApprovalWorkflow"("companyId", "scope", "status");
CREATE INDEX "EnterpriseApprovalWorkflow_departmentId_status_idx" ON "EnterpriseApprovalWorkflow"("departmentId", "status");

CREATE INDEX "EnterpriseRoleAssignment_companyId_role_scope_idx" ON "EnterpriseRoleAssignment"("companyId", "role", "scope");
CREATE INDEX "EnterpriseRoleAssignment_userId_role_startsAt_idx" ON "EnterpriseRoleAssignment"("userId", "role", "startsAt");
CREATE INDEX "EnterpriseRoleAssignment_departmentId_role_idx" ON "EnterpriseRoleAssignment"("departmentId", "role");
CREATE INDEX "EnterpriseRoleAssignment_teamId_role_idx" ON "EnterpriseRoleAssignment"("teamId", "role");

CREATE INDEX "EnterpriseAuditEvent_companyId_createdAt_idx" ON "EnterpriseAuditEvent"("companyId", "createdAt");
CREATE INDEX "EnterpriseAuditEvent_companyId_entityType_entityId_createdAt_idx" ON "EnterpriseAuditEvent"("companyId", "entityType", "entityId", "createdAt");
CREATE INDEX "EnterpriseAuditEvent_actorId_createdAt_idx" ON "EnterpriseAuditEvent"("actorId", "createdAt");
CREATE INDEX "EnterpriseAuditEvent_action_createdAt_idx" ON "EnterpriseAuditEvent"("action", "createdAt");

CREATE INDEX "Task_enterpriseAssignedTeamId_enterpriseQueuePriority_enterpriseSlaDueAt_idx" ON "Task"("enterpriseAssignedTeamId", "enterpriseQueuePriority", "enterpriseSlaDueAt");
CREATE INDEX "Task_enterpriseDepartmentId_stage_createdAt_idx" ON "Task"("enterpriseDepartmentId", "stage", "createdAt");

ALTER TABLE "EnterpriseDepartment" ADD CONSTRAINT "EnterpriseDepartment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseDepartment" ADD CONSTRAINT "EnterpriseDepartment_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseDepartment" ADD CONSTRAINT "EnterpriseDepartment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseTeam" ADD CONSTRAINT "EnterpriseTeam_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseTeam" ADD CONSTRAINT "EnterpriseTeam_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseTeam" ADD CONSTRAINT "EnterpriseTeam_parentTeamId_fkey" FOREIGN KEY ("parentTeamId") REFERENCES "EnterpriseTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseTeam" ADD CONSTRAINT "EnterpriseTeam_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseTeamMember" ADD CONSTRAINT "EnterpriseTeamMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseTeamMember" ADD CONSTRAINT "EnterpriseTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "EnterpriseTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseTeamMember" ADD CONSTRAINT "EnterpriseTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseTaskAssignment" ADD CONSTRAINT "EnterpriseTaskAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseTaskAssignment" ADD CONSTRAINT "EnterpriseTaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseTaskAssignment" ADD CONSTRAINT "EnterpriseTaskAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseTaskAssignment" ADD CONSTRAINT "EnterpriseTaskAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "EnterpriseTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseTaskAssignment" ADD CONSTRAINT "EnterpriseTaskAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseSlaPolicy" ADD CONSTRAINT "EnterpriseSlaPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseSlaPolicy" ADD CONSTRAINT "EnterpriseSlaPolicy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseAssetCategory" ADD CONSTRAINT "EnterpriseAssetCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseAsset" ADD CONSTRAINT "EnterpriseAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseAsset" ADD CONSTRAINT "EnterpriseAsset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EnterpriseAssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseAsset" ADD CONSTRAINT "EnterpriseAsset_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseAsset" ADD CONSTRAINT "EnterpriseAsset_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "EnterpriseTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseAsset" ADD CONSTRAINT "EnterpriseAsset_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseIncident" ADD CONSTRAINT "EnterpriseIncident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIncident" ADD CONSTRAINT "EnterpriseIncident_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIncident" ADD CONSTRAINT "EnterpriseIncident_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "EnterpriseTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIncident" ADD CONSTRAINT "EnterpriseIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIncident" ADD CONSTRAINT "EnterpriseIncident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIncident" ADD CONSTRAINT "EnterpriseIncident_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EnterpriseAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIncident" ADD CONSTRAINT "EnterpriseIncident_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "EnterpriseSlaPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseMaintenancePlan" ADD CONSTRAINT "EnterpriseMaintenancePlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseMaintenancePlan" ADD CONSTRAINT "EnterpriseMaintenancePlan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EnterpriseAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseMaintenancePlan" ADD CONSTRAINT "EnterpriseMaintenancePlan_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "EnterpriseAssetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseMaintenancePlan" ADD CONSTRAINT "EnterpriseMaintenancePlan_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseMaintenanceWorkOrder" ADD CONSTRAINT "EnterpriseMaintenanceWorkOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseMaintenanceWorkOrder" ADD CONSTRAINT "EnterpriseMaintenanceWorkOrder_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EnterpriseAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseMaintenanceWorkOrder" ADD CONSTRAINT "EnterpriseMaintenanceWorkOrder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EnterpriseMaintenancePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseMaintenanceWorkOrder" ADD CONSTRAINT "EnterpriseMaintenanceWorkOrder_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EnterpriseIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseMaintenanceWorkOrder" ADD CONSTRAINT "EnterpriseMaintenanceWorkOrder_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseMaintenanceWorkOrder" ADD CONSTRAINT "EnterpriseMaintenanceWorkOrder_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "EnterpriseTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseMaintenanceWorkOrder" ADD CONSTRAINT "EnterpriseMaintenanceWorkOrder_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseComplianceControl" ADD CONSTRAINT "EnterpriseComplianceControl_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseComplianceControl" ADD CONSTRAINT "EnterpriseComplianceControl_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseApprovalWorkflow" ADD CONSTRAINT "EnterpriseApprovalWorkflow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseApprovalWorkflow" ADD CONSTRAINT "EnterpriseApprovalWorkflow_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseApprovalWorkflow" ADD CONSTRAINT "EnterpriseApprovalWorkflow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseRoleAssignment" ADD CONSTRAINT "EnterpriseRoleAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseRoleAssignment" ADD CONSTRAINT "EnterpriseRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseRoleAssignment" ADD CONSTRAINT "EnterpriseRoleAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseRoleAssignment" ADD CONSTRAINT "EnterpriseRoleAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "EnterpriseTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseAuditEvent" ADD CONSTRAINT "EnterpriseAuditEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseAuditEvent" ADD CONSTRAINT "EnterpriseAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_enterpriseAssignedTeamId_fkey" FOREIGN KEY ("enterpriseAssignedTeamId") REFERENCES "EnterpriseTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_enterpriseDepartmentId_fkey" FOREIGN KEY ("enterpriseDepartmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_enterprise_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'EnterpriseAuditEvent records are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EnterpriseAuditEvent_prevent_update"
BEFORE UPDATE ON "EnterpriseAuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_enterprise_audit_event_mutation();

CREATE TRIGGER "EnterpriseAuditEvent_prevent_delete"
BEFORE DELETE ON "EnterpriseAuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_enterprise_audit_event_mutation();
