-- CreateEnum
CREATE TYPE "EmsCallSource" AS ENUM ('PHONE', 'RADIO', 'MOBILE_APP', 'WEBSITE', 'ALERT_SYSTEM', 'AI_DETECTED', 'HOSPITAL_TRANSFER', 'DIRECT_DISPATCH');
CREATE TYPE "EmsSeverity" AS ENUM ('ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'OMEGA');
CREATE TYPE "EmsIncidentStatus" AS ENUM ('PENDING', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'COMPLETED', 'CANCELLED', 'STANDBY', 'ESCALATED');
CREATE TYPE "EmsUnitStatus" AS ENUM ('AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'DECONTAMINATION', 'MAINTENANCE', 'OFFLINE', 'RESERVE');
CREATE TYPE "EmsUnitType" AS ENUM ('AMBULANCE', 'ALS_AMBULANCE', 'BLS_AMBULANCE', 'MICU', 'RESPONSE_VEHICLE', 'AIR_AMBULANCE', 'SUPERVISOR', 'MASS_CASUALTY_BUS', 'REHAB_UNIT', 'COMMAND_VEHICLE', 'MOTORCYCLE_RESPONSE');
CREATE TYPE "EmsDispatchDecision" AS ENUM ('AI_SUGGESTED', 'AI_AUTO_DISPATCH', 'DISPATCHER_MANUAL', 'SUPERVISOR_OVERRIDE', 'CREW_SELF_ASSIGN');
CREATE TYPE "EmsHospitalStatus" AS ENUM ('OPEN', 'DIVERT', 'CONTAINMENT', 'FULL', 'CLOSED');
CREATE TYPE "EmsHospitalCapability" AS ENUM ('LEVEL_1_TRAUMA', 'LEVEL_2_TRAUMA', 'LEVEL_3_TRAUMA', 'LEVEL_4_TRAUMA', 'STROKE_CENTER', 'CARDIAC_CENTER', 'BURN_CENTER', 'PEDIATRIC', 'NEONATAL_ICU', 'DECONTAMINATION');
CREATE TYPE "EmsAssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'TRANSFERRED');
CREATE TYPE "EmsPatientStatus" AS ENUM ('STABLE', 'MODERATE', 'CRITICAL', 'DECEASED', 'TRANSPORTED', 'RELEASED');
CREATE TYPE "EmsTriageCategory" AS ENUM ('IMMEDIATE', 'DELAYED', 'MINIMAL', 'EXPECTANT', 'UNKNOWN');

-- CreateTable: EmsCompany
CREATE TABLE "EmsCompany" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regionCode" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dispatchMode" TEXT NOT NULL DEFAULT 'semi_auto',
    "defaultRadioChannel" TEXT,
    "autoDispatchThreshold" DOUBLE PRECISION DEFAULT 0.6,
    "responseTimeTarget" INTEGER DEFAULT 480,
    "enableAiClassification" BOOLEAN DEFAULT true,
    "enableAutoDispatch" BOOLEAN DEFAULT false,
    "enablePredictiveAlerts" BOOLEAN DEFAULT true,
    "settings" JSONB,
    "mciPlanUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsCompany_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmsCompany_companyId_key" ON "EmsCompany"("companyId");
ALTER TABLE "EmsCompany" ADD CONSTRAINT "EmsCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsStation
CREATE TABLE "EmsStation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "type" TEXT NOT NULL DEFAULT 'primary',
    "capacity" INTEGER NOT NULL DEFAULT 10,
    "status" "EmsUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "coverage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsStation_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsStation" ADD CONSTRAINT "EmsStation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsUnit
CREATE TABLE "EmsUnit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "type" "EmsUnitType" NOT NULL DEFAULT 'AMBULANCE',
    "status" "EmsUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "stationId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "fuelLevel" DOUBLE PRECISION,
    "odometer" DOUBLE PRECISION,
    "crewCapacity" INTEGER NOT NULL DEFAULT 2,
    "patientCapacity" INTEGER NOT NULL DEFAULT 1,
    "equipment" JSONB,
    "capabilities" JSONB,
    "lastGpsUpdate" TIMESTAMP(3),
    "lastPing" TIMESTAMP(3),
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "batteryLevel" DOUBLE PRECISION,
    "currentIncidentId" TEXT,
    "shiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsUnit_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsUnit" ADD CONSTRAINT "EmsUnit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmsUnit" ADD CONSTRAINT "EmsUnit_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "EmsStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "EmsUnit_companyId_status_idx" ON "EmsUnit"("companyId", "status");
CREATE INDEX "EmsUnit_companyId_stationId_idx" ON "EmsUnit"("companyId", "stationId");

-- CreateTable: EmsUnitLocation
CREATE TABLE "EmsUnitLocation" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'gps',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmsUnitLocation_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsUnitLocation" ADD CONSTRAINT "EmsUnitLocation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "EmsUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "EmsUnitLocation_unitId_recordedAt_idx" ON "EmsUnitLocation"("unitId", "recordedAt");
CREATE INDEX "EmsUnitLocation_recordedAt_idx" ON "EmsUnitLocation"("recordedAt");

-- CreateTable: EmsCrew
CREATE TABLE "EmsCrew" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL DEFAULT 'ALS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsCrew_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsCrew" ADD CONSTRAINT "EmsCrew_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsCrewMember
CREATE TABLE "EmsCrewMember" (
    "id" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT,
    "role" TEXT NOT NULL,
    "certified" BOOLEAN NOT NULL DEFAULT true,
    "fatigue" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'available',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmsCrewMember_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsCrewMember" ADD CONSTRAINT "EmsCrewMember_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "EmsCrew"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmsCrewMember" ADD CONSTRAINT "EmsCrewMember_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "EmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "EmsCrewMember_crewId_userId_key" ON "EmsCrewMember"("crewId", "userId");

-- CreateTable: EmsDispatcher
CREATE TABLE "EmsDispatcher" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consoleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "lastPing" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmsDispatcher_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsDispatcher" ADD CONSTRAINT "EmsDispatcher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsHospital
CREATE TABLE "EmsHospital" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "edPhone" TEXT,
    "status" "EmsHospitalStatus" NOT NULL DEFAULT 'OPEN',
    "capabilities" "EmsHospitalCapability"[],
    "traumaLevel" INTEGER,
    "bedCount" INTEGER NOT NULL DEFAULT 0,
    "availableBeds" INTEGER NOT NULL DEFAULT 0,
    "icuBeds" INTEGER NOT NULL DEFAULT 0,
    "availableIcu" INTEGER NOT NULL DEFAULT 0,
    "waitTimeMinutes" INTEGER,
    "diversionInfo" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsHospital_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsHospital" ADD CONSTRAINT "EmsHospital_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "EmsHospital_companyId_status_idx" ON "EmsHospital"("companyId", "status");

-- CreateTable: EmsIncident
CREATE TABLE "EmsIncident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "callSource" "EmsCallSource" NOT NULL DEFAULT 'PHONE',
    "severity" "EmsSeverity" NOT NULL DEFAULT 'ALPHA',
    "status" "EmsIncidentStatus" NOT NULL DEFAULT 'PENDING',
    "triage" "EmsTriageCategory",
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "address" TEXT,
    "locationDetails" TEXT,
    "zone" TEXT,
    "callerName" TEXT,
    "callerPhone" TEXT,
    "callerNotes" TEXT,
    "calledAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "enRouteAt" TIMESTAMP(3),
    "onSceneAt" TIMESTAMP(3),
    "transportingAt" TIMESTAMP(3),
    "atHospitalAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "chiefComplaint" TEXT,
    "symptoms" TEXT,
    "mechanismOfInjury" TEXT,
    "patientCount" INTEGER NOT NULL DEFAULT 1,
    "aiSeverityScore" DOUBLE PRECISION,
    "aiSummary" TEXT,
    "aiClassification" TEXT,
    "dispatchDecision" "EmsDispatchDecision",
    "dispatchNotes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "etaSeconds" INTEGER,
    "distanceKm" DOUBLE PRECISION,
    "hospitalId" TEXT,
    "hospitalEtaSeconds" INTEGER,
    "assignedUnitId" TEXT,
    "createdById" TEXT,
    "weather" JSONB,
    "traffic" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsIncident_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmsIncident_incidentNumber_key" ON "EmsIncident"("incidentNumber");
ALTER TABLE "EmsIncident" ADD CONSTRAINT "EmsIncident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmsIncident" ADD CONSTRAINT "EmsIncident_assignedUnitId_fkey" FOREIGN KEY ("assignedUnitId") REFERENCES "EmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmsIncident" ADD CONSTRAINT "EmsIncident_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "EmsHospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "EmsIncident_companyId_status_idx" ON "EmsIncident"("companyId", "status");
CREATE INDEX "EmsIncident_companyId_createdAt_idx" ON "EmsIncident"("companyId", "createdAt");
CREATE INDEX "EmsIncident_severity_idx" ON "EmsIncident"("severity");
CREATE INDEX "EmsIncident_assignedUnitId_idx" ON "EmsIncident"("assignedUnitId");

-- CreateTable: EmsAssignment
CREATE TABLE "EmsAssignment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" "EmsAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "role" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "etaSeconds" INTEGER,
    "distanceKm" DOUBLE PRECISION,
    CONSTRAINT "EmsAssignment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsAssignment" ADD CONSTRAINT "EmsAssignment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmsIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmsAssignment" ADD CONSTRAINT "EmsAssignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "EmsUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "EmsAssignment_incidentId_idx" ON "EmsAssignment"("incidentId");
CREATE INDEX "EmsAssignment_unitId_idx" ON "EmsAssignment"("unitId");

-- CreateTable: EmsPatient
CREATE TABLE "EmsPatient" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "patientNumber" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "bloodType" TEXT,
    "status" "EmsPatientStatus" NOT NULL DEFAULT 'STABLE',
    "triage" "EmsTriageCategory",
    "chiefComplaint" TEXT,
    "symptoms" TEXT,
    "medicalHistory" TEXT,
    "allergies" TEXT,
    "medications" TEXT,
    "vitals" JSONB,
    "ecgUrl" TEXT,
    "ecgInterpretation" TEXT,
    "aiAssessment" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsPatient_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsPatient" ADD CONSTRAINT "EmsPatient_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmsIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsIncidentTimeline
CREATE TABLE "EmsIncidentTimeline" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actorId" TEXT,
    "metadata" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmsIncidentTimeline_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsIncidentTimeline" ADD CONSTRAINT "EmsIncidentTimeline_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmsIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "EmsIncidentTimeline_incidentId_recordedAt_idx" ON "EmsIncidentTimeline"("incidentId", "recordedAt");

-- CreateTable: EmsCommunication
CREATE TABLE "EmsCommunication" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'radio',
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "fromUnitId" TEXT,
    "toUnitId" TEXT,
    "messageType" TEXT NOT NULL DEFAULT 'voice',
    "content" TEXT,
    "duration" INTEGER,
    "transcript" TEXT,
    "aiSummary" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmsCommunication_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsCommunication" ADD CONSTRAINT "EmsCommunication_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmsIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "EmsCommunication_incidentId_recordedAt_idx" ON "EmsCommunication"("incidentId", "recordedAt");

-- CreateTable: EmsIncidentMedia
CREATE TABLE "EmsIncidentMedia" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "uploadedById" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmsIncidentMedia_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsIncidentMedia" ADD CONSTRAINT "EmsIncidentMedia_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmsIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsIncidentNote
CREATE TABLE "EmsIncidentNote" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsIncidentNote_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsIncidentNote" ADD CONSTRAINT "EmsIncidentNote_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmsIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsDispatchLog
CREATE TABLE "EmsDispatchLog" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "dispatchedUnitIds" TEXT[],
    "decisionType" "EmsDispatchDecision" NOT NULL DEFAULT 'DISPATCHER_MANUAL',
    "aiConfidence" DOUBLE PRECISION,
    "aiReasoning" TEXT,
    "dispatcherId" TEXT,
    "supervisorId" TEXT,
    "responseTime" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmsDispatchLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsDispatchLog" ADD CONSTRAINT "EmsDispatchLog_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmsIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsAiDecision
CREATE TABLE "EmsAiDecision" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "confidence" DOUBLE PRECISION,
    "reasoning" TEXT,
    "modelVersion" TEXT,
    "accepted" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmsAiDecision_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsAiDecision" ADD CONSTRAINT "EmsAiDecision_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmsIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "EmsAiDecision_incidentId_decisionType_idx" ON "EmsAiDecision"("incidentId", "decisionType");

-- CreateTable: EmsUnitMaintenance
CREATE TABLE "EmsUnitMaintenance" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmsUnitMaintenance_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsUnitMaintenance" ADD CONSTRAINT "EmsUnitMaintenance_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "EmsUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsProtocol
CREATE TABLE "EmsProtocol" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL,
    "severity" "EmsSeverity",
    "content" JSONB,
    "pdfUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsProtocol_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsProtocol" ADD CONSTRAINT "EmsProtocol_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsAutomationRule
CREATE TABLE "EmsAutomationRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" TEXT NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsAutomationRule_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsAutomationRule" ADD CONSTRAINT "EmsAutomationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsWorkflowExecution
CREATE TABLE "EmsWorkflowExecution" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "ruleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "steps" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "EmsWorkflowExecution_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsWorkflowExecution" ADD CONSTRAINT "EmsWorkflowExecution_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmsIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmsWorkflowExecution" ADD CONSTRAINT "EmsWorkflowExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "EmsAutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: EmsSupplyStock
CREATE TABLE "EmsSupplyStock" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT,
    "itemName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 10,
    "unitPrice" DOUBLE PRECISION,
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "lastRestocked" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsSupplyStock_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsSupplyStock" ADD CONSTRAINT "EmsSupplyStock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmsSupplyStock" ADD CONSTRAINT "EmsSupplyStock_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "EmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: EmsNotification
CREATE TABLE "EmsNotification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "incidentId" TEXT,
    "hospitalId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'push',
    "recipients" JSONB,
    "sentAt" TIMESTAMP(3),
    "readBy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmsNotification_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsNotification" ADD CONSTRAINT "EmsNotification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmsNotification" ADD CONSTRAINT "EmsNotification_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmsIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmsNotification" ADD CONSTRAINT "EmsNotification_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "EmsHospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: EmsAnalytics
CREATE TABLE "EmsAnalytics" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalIncidentsToday" INTEGER NOT NULL DEFAULT 0,
    "activeIncidents" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION,
    "avgOnSceneTime" DOUBLE PRECISION,
    "avgTransportTime" DOUBLE PRECISION,
    "unitsAvailable" INTEGER NOT NULL DEFAULT 0,
    "unitsInService" INTEGER NOT NULL DEFAULT 0,
    "hospitalsOnDivert" INTEGER NOT NULL DEFAULT 0,
    "peakHour" INTEGER,
    "mciCount" INTEGER NOT NULL DEFAULT 0,
    "aiDispatches" INTEGER NOT NULL DEFAULT 0,
    "autoDispatches" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmsAnalytics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmsAnalytics_companyId_key" ON "EmsAnalytics"("companyId");
ALTER TABLE "EmsAnalytics" ADD CONSTRAINT "EmsAnalytics_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EmsPredictiveZone
CREATE TABLE "EmsPredictiveZone" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "zoneName" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "riskScore" DOUBLE PRECISION,
    "incidentCount" INTEGER NOT NULL DEFAULT 0,
    "lastIncidentAt" TIMESTAMP(3),
    "forecast" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmsPredictiveZone_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmsPredictiveZone" ADD CONSTRAINT "EmsPredictiveZone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "EmsPredictiveZone_companyId_active_idx" ON "EmsPredictiveZone"("companyId", "active");
