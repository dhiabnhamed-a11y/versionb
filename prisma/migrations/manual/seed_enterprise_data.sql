-- Enterprise ESM Seed Data
-- Run after migration SQL. Inserts default reference data per company.

-- ── Default SLA Policies (per company inserted by app) ──────────
-- These are inserted programmatically on company creation.
-- For manual seeding, use:
-- INSERT INTO "EnterpriseSlaPolicy" ("id", "companyId", "name", "scope", "priority", "severity", "responseMinutes", "resolutionMinutes", "defaultPolicy", "status", "createdAt", "updatedAt")
-- VALUES (gen_random_uuid()::text, '<companyId>', 'P1 Critical', 'INCIDENT', 'P1', 'CRITICAL', 15, 60, true, 'ACTIVE', now(), now());

-- ── Default Asset Categories (per company) ──────────────────────
-- INSERT INTO "EnterpriseAssetCategory" ("id", "companyId", "name", "code", "assetType", "riskWeight", "status", "createdAt", "updatedAt")
-- VALUES
--   (gen_random_uuid()::text, '<companyId>', 'Workstation', 'WS', 'HARDWARE', 50, 'ACTIVE', now(), now()),
--   (gen_random_uuid()::text, '<companyId>', 'Server', 'SRV', 'HARDWARE', 90, 'ACTIVE', now(), now()),
--   (gen_random_uuid()::text, '<companyId>', 'Network Equipment', 'NET', 'HARDWARE', 80, 'ACTIVE', now(), now()),
--   (gen_random_uuid()::text, '<companyId>', 'Software License', 'SW', 'SOFTWARE', 30, 'ACTIVE', now(), now()),
--   (gen_random_uuid()::text, '<companyId>', 'Mobile Device', 'MOB', 'HARDWARE', 60, 'ACTIVE', now(), now());

-- ── Default Departments (per company) ────────────────────────────
-- INSERT INTO "EnterpriseDepartment" ("id", "companyId", "name", "code", "status", "workloadTarget", "createdAt", "updatedAt")
-- VALUES
--   (gen_random_uuid()::text, '<companyId>', 'IT Operations', 'IT_OPS', 'ACTIVE', 100, now(), now()),
--   (gen_random_uuid()::text, '<companyId>', 'Service Desk', 'SVC_DESK', 'ACTIVE', 150, now(), now()),
--   (gen_random_uuid()::text, '<companyId>', 'Infrastructure', 'INFRA', 'ACTIVE', 80, now(), now());
