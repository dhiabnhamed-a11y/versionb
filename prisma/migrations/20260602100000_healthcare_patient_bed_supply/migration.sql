-- Healthcare workspace: patient census, bed management, medical supply inventory
-- Run in Supabase SQL Editor (DDL is blocked through PgBouncer pooler)

-- HospitalBed must be created before HospitalPatient (FK dependency)
CREATE TABLE IF NOT EXISTS "HospitalBed" (
  "id"          TEXT        NOT NULL,
  "companyId"   TEXT        NOT NULL,
  "bedNumber"   TEXT        NOT NULL,
  "ward"        TEXT        NOT NULL,
  "department"  TEXT,
  "floor"       TEXT,
  "roomNumber"  TEXT,
  "type"        TEXT        NOT NULL DEFAULT 'GENERAL',
  "status"      TEXT        NOT NULL DEFAULT 'AVAILABLE',
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HospitalBed_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HospitalBed_companyId_bedNumber_ward_key"
  ON "HospitalBed"("companyId", "bedNumber", "ward");
CREATE INDEX IF NOT EXISTS "HospitalBed_companyId_status_idx"
  ON "HospitalBed"("companyId", "status");
CREATE INDEX IF NOT EXISTS "HospitalBed_companyId_ward_status_idx"
  ON "HospitalBed"("companyId", "ward", "status");

ALTER TABLE "HospitalBed"
  ADD CONSTRAINT "HospitalBed_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "HospitalPatient" (
  "id"                TEXT        NOT NULL,
  "companyId"         TEXT        NOT NULL,
  "patientNumber"     TEXT        NOT NULL,
  "firstName"         TEXT        NOT NULL,
  "lastName"          TEXT        NOT NULL,
  "dateOfBirth"       TIMESTAMP(3),
  "gender"            TEXT,
  "admissionDate"     TIMESTAMP(3),
  "dischargeDate"     TIMESTAMP(3),
  "expectedDischarge" TIMESTAMP(3),
  "status"            TEXT        NOT NULL DEFAULT 'REGISTERED',
  "department"        TEXT,
  "bedId"             TEXT,
  "primaryPhysician"  TEXT,
  "admissionReason"   TEXT,
  "diagnosisCode"     TEXT,
  "insuranceProvider" TEXT,
  "insurancePolicyNo" TEXT,
  "contactPhone"      TEXT,
  "contactName"       TEXT,
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HospitalPatient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HospitalPatient_companyId_patientNumber_key"
  ON "HospitalPatient"("companyId", "patientNumber");
CREATE INDEX IF NOT EXISTS "HospitalPatient_companyId_status_idx"
  ON "HospitalPatient"("companyId", "status");
CREATE INDEX IF NOT EXISTS "HospitalPatient_companyId_admissionDate_idx"
  ON "HospitalPatient"("companyId", "admissionDate");
CREATE INDEX IF NOT EXISTS "HospitalPatient_companyId_department_status_idx"
  ON "HospitalPatient"("companyId", "department", "status");
CREATE INDEX IF NOT EXISTS "HospitalPatient_bedId_idx"
  ON "HospitalPatient"("bedId");

ALTER TABLE "HospitalPatient"
  ADD CONSTRAINT "HospitalPatient_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalPatient"
  ADD CONSTRAINT "HospitalPatient_bedId_fkey"
  FOREIGN KEY ("bedId") REFERENCES "HospitalBed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "HospitalMedicalSupply" (
  "id"              TEXT        NOT NULL,
  "companyId"       TEXT        NOT NULL,
  "name"            TEXT        NOT NULL,
  "sku"             TEXT,
  "category"        TEXT        NOT NULL,
  "unit"            TEXT        NOT NULL DEFAULT 'units',
  "currentStock"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "minimumStock"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "reorderPoint"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "maximumStock"    DECIMAL(12,2),
  "expiresAt"       TIMESTAMP(3),
  "batchNumber"     TEXT,
  "department"      TEXT,
  "location"        TEXT,
  "isCritical"      BOOLEAN     NOT NULL DEFAULT false,
  "supplierId"      TEXT,
  "unitCost"        DECIMAL(12,4),
  "notes"           TEXT,
  "lastRestockedAt" TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HospitalMedicalSupply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HospitalMedicalSupply_companyId_category_idx"
  ON "HospitalMedicalSupply"("companyId", "category");
CREATE INDEX IF NOT EXISTS "HospitalMedicalSupply_companyId_isCritical_currentStock_idx"
  ON "HospitalMedicalSupply"("companyId", "isCritical", "currentStock");
CREATE INDEX IF NOT EXISTS "HospitalMedicalSupply_companyId_expiresAt_idx"
  ON "HospitalMedicalSupply"("companyId", "expiresAt");
CREATE INDEX IF NOT EXISTS "HospitalMedicalSupply_companyId_department_idx"
  ON "HospitalMedicalSupply"("companyId", "department");

ALTER TABLE "HospitalMedicalSupply"
  ADD CONSTRAINT "HospitalMedicalSupply_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Auto-update updatedAt via trigger (reuse pattern)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hospital_patient_updated_at') THEN
    CREATE TRIGGER hospital_patient_updated_at
      BEFORE UPDATE ON "HospitalPatient"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hospital_bed_updated_at') THEN
    CREATE TRIGGER hospital_bed_updated_at
      BEFORE UPDATE ON "HospitalBed"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hospital_medical_supply_updated_at') THEN
    CREATE TRIGGER hospital_medical_supply_updated_at
      BEFORE UPDATE ON "HospitalMedicalSupply"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
