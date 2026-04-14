-- ============================================================
-- TaskForce — PostgreSQL Schema for Supabase
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS "User" (
    "id"        TEXT        NOT NULL PRIMARY KEY,
    "name"      TEXT        NOT NULL,
    "email"     TEXT        NOT NULL UNIQUE,
    "password"  TEXT        NOT NULL,
    "role"      TEXT        NOT NULL DEFAULT 'EMPLOYEE',
    "avatar"    TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Company" (
    "id"        TEXT        NOT NULL PRIMARY KEY,
    "name"      TEXT        NOT NULL,
    "ownerId"   TEXT        NOT NULL UNIQUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Company_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Add FK to User after Company exists
ALTER TABLE "User"
    ADD CONSTRAINT "User_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Project" (
    "id"          TEXT        NOT NULL PRIMARY KEY,
    "title"       TEXT        NOT NULL,
    "description" TEXT,
    "companyId"   TEXT        NOT NULL,
    "managerId"   TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Project_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_managerId_fkey"
        FOREIGN KEY ("managerId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Task" (
    "id"          TEXT        NOT NULL PRIMARY KEY,
    "title"       TEXT        NOT NULL,
    "description" TEXT,
    "priority"    TEXT        NOT NULL DEFAULT 'MEDIUM',
    "deadline"    TIMESTAMPTZ,
    "assigneeId"  TEXT,
    "projectId"   TEXT        NOT NULL,
    "stage"       TEXT        NOT NULL DEFAULT 'TODO',
    "progress"    INTEGER     NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Task_assigneeId_fkey"
        FOREIGN KEY ("assigneeId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Activity" (
    "id"        TEXT        NOT NULL PRIMARY KEY,
    "taskId"    TEXT        NOT NULL,
    "userId"    TEXT        NOT NULL,
    "action"    TEXT        NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Activity_taskId_fkey"
        FOREIGN KEY ("taskId") REFERENCES "Task" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Alert" (
    "id"          TEXT        NOT NULL PRIMARY KEY,
    "type"        TEXT        NOT NULL,
    "title"       TEXT        NOT NULL,
    "message"     TEXT        NOT NULL,
    "senderId"    TEXT        NOT NULL,
    "recipientId" TEXT        NOT NULL,
    "read"        BOOLEAN     NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Alert_senderId_fkey"
        FOREIGN KEY ("senderId") REFERENCES "User" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Alert_recipientId_fkey"
        FOREIGN KEY ("recipientId") REFERENCES "User" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 2. PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "Task_assigneeId_idx"   ON "Task"("assigneeId");
CREATE INDEX IF NOT EXISTS "Task_projectId_idx"    ON "Task"("projectId");
CREATE INDEX IF NOT EXISTS "Task_stage_idx"        ON "Task"("stage");
CREATE INDEX IF NOT EXISTS "Activity_taskId_idx"   ON "Activity"("taskId");
CREATE INDEX IF NOT EXISTS "Alert_recipientId_idx" ON "Alert"("recipientId");
CREATE INDEX IF NOT EXISTS "Alert_senderId_idx"    ON "Alert"("senderId");
CREATE INDEX IF NOT EXISTS "Project_companyId_idx" ON "Project"("companyId");
CREATE INDEX IF NOT EXISTS "User_companyId_idx"    ON "User"("companyId");

-- 3. PRISMA MIGRATION TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    VARCHAR(36)  NOT NULL PRIMARY KEY,
    "checksum"              VARCHAR(64)  NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "applied_steps_count"   INTEGER      NOT NULL DEFAULT 0
);

-- 4. SEED DATA
-- ============================================================
-- All passwords: password123 (bcrypt 12 rounds)

INSERT INTO "User" ("id", "name", "email", "password", "role", "createdAt", "updatedAt") VALUES
('user-owner-001',   'Alex Johnson', 'owner@taskforce.com',   '$2a$12$LJ3m4uB9hFwJGfOQhXSjLuXnES8YHKoN8Q7t7fZluZzRtA2mTpKJy', 'OWNER',    now(), now()),
('user-manager-001', 'Sarah Chen',   'manager@taskforce.com', '$2a$12$LJ3m4uB9hFwJGfOQhXSjLuXnES8YHKoN8Q7t7fZluZzRtA2mTpKJy', 'MANAGER',  now(), now()),
('user-emp-001',     'Mike Rivera',  'emp1@taskforce.com',    '$2a$12$LJ3m4uB9hFwJGfOQhXSjLuXnES8YHKoN8Q7t7fZluZzRtA2mTpKJy', 'EMPLOYEE', now(), now()),
('user-emp-002',     'Priya Patel',  'emp2@taskforce.com',    '$2a$12$LJ3m4uB9hFwJGfOQhXSjLuXnES8YHKoN8Q7t7fZluZzRtA2mTpKJy', 'EMPLOYEE', now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Company" ("id", "name", "ownerId", "createdAt") VALUES
('company-001', 'TaskForce Inc.', 'user-owner-001', now())
ON CONFLICT ("id") DO NOTHING;

UPDATE "User" SET "companyId" = 'company-001' WHERE "id" IN ('user-owner-001', 'user-manager-001', 'user-emp-001', 'user-emp-002');

INSERT INTO "Project" ("id", "title", "description", "companyId", "managerId", "createdAt", "updatedAt") VALUES
('proj-001', 'Website Redesign',  'Full company website overhaul', 'company-001', 'user-manager-001', now(), now()),
('proj-002', 'Mobile App Launch', 'Q2 mobile app release',         'company-001', 'user-manager-001', now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Task" ("id", "title", "description", "priority", "deadline", "assigneeId", "projectId", "stage", "progress", "createdAt", "updatedAt") VALUES
('task-001', 'Design new landing page',      'Detailed implementation task', 'HIGH',     now() + interval '3 days',  'user-emp-001', 'proj-001', 'IN_PROGRESS', 40,  now(), now()),
('task-002', 'Fix navigation bug',           'Detailed implementation task', 'CRITICAL', now() + interval '1 day',   'user-emp-001', 'proj-001', 'TODO',        0,   now(), now()),
('task-003', 'Write API documentation',      'Detailed implementation task', 'MEDIUM',   now() + interval '7 days',  'user-emp-002', 'proj-002', 'REVIEW',      75,  now(), now()),
('task-004', 'Implement push notifications', 'Detailed implementation task', 'HIGH',     now() - interval '2 days',  'user-emp-002', 'proj-002', 'DONE',        100, now(), now()),
('task-005', 'User testing session setup',   'Detailed implementation task', 'LOW',      now() + interval '14 days', 'user-emp-001', 'proj-002', 'TODO',        0,   now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Activity" ("id", "taskId", "userId", "action", "createdAt") VALUES
('act-001', 'task-001', 'user-emp-001', 'Task created',   now()),
('act-002', 'task-002', 'user-emp-001', 'Task created',   now()),
('act-003', 'task-003', 'user-emp-002', 'Task created',   now()),
('act-004', 'task-004', 'user-emp-002', 'Task completed', now()),
('act-005', 'task-005', 'user-emp-001', 'Task created',   now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Alert" ("id", "type", "title", "message", "senderId", "recipientId", "read", "createdAt") VALUES
('alert-001', 'URGENT_TASK',      'Critical bug on production', 'The login page is broken. Please fix ASAP.',                 'user-owner-001',   'user-emp-001', false, now()),
('alert-002', 'DEADLINE_WARNING', 'Deadline approaching',       'API documentation is due in 2 days. Submit for review.',      'user-manager-001', 'user-emp-002', false, now()),
('alert-003', 'MANAGER_CALL',     'Quick sync needed',          'Join a quick call to discuss the mobile app timeline.',        'user-manager-001', 'user-emp-001', true,  now())
ON CONFLICT ("id") DO NOTHING;

-- ============================================================
-- Done! Your TaskForce database is ready.
-- Demo logins (password: password123):
--   Owner:    owner@taskforce.com
--   Manager:  manager@taskforce.com
--   Employee: emp1@taskforce.com / emp2@taskforce.com
-- ============================================================
