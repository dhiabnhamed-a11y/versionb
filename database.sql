-- ============================================================
-- TaskForce — Complete Database Schema
-- Database: SQLite (compatible with PostgreSQL with minor changes)
-- Generated from Prisma schema
-- ============================================================

-- ============================================================
-- 1. SCHEMA: TABLE DEFINITIONS
-- ============================================================

-- Drop tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS "Alert";
DROP TABLE IF EXISTS "Activity";
DROP TABLE IF EXISTS "Task";
DROP TABLE IF EXISTS "Project";
DROP TABLE IF EXISTS "Company";
DROP TABLE IF EXISTS "User";


-- -------------------------------------------------------
-- TABLE: User
-- Stores all platform users (Owners, Managers, Employees)
-- -------------------------------------------------------
CREATE TABLE "User" (
    "id"        TEXT     NOT NULL PRIMARY KEY,           -- CUID identifier
    "name"      TEXT     NOT NULL,                       -- Full display name
    "email"     TEXT     NOT NULL,                       -- Login email (unique)
    "password"  TEXT     NOT NULL,                       -- bcrypt-hashed password
    "role"      TEXT     NOT NULL DEFAULT 'EMPLOYEE',    -- OWNER | MANAGER | EMPLOYEE
    "avatar"    TEXT,                                    -- Optional avatar URL
    "companyId" TEXT,                                    -- FK → Company (nullable: owner starts without one)
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    CONSTRAINT "User_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);


-- -------------------------------------------------------
-- TABLE: Company
-- A workspace / organisation. One owner per company.
-- -------------------------------------------------------
CREATE TABLE "Company" (
    "id"        TEXT     NOT NULL PRIMARY KEY,           -- CUID identifier
    "name"      TEXT     NOT NULL,                       -- Company display name
    "ownerId"   TEXT     NOT NULL,                       -- FK → User (unique, 1:1)
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);


-- -------------------------------------------------------
-- TABLE: Project
-- Groups tasks under a named project with an optional manager.
-- -------------------------------------------------------
CREATE TABLE "Project" (
    "id"          TEXT     NOT NULL PRIMARY KEY,         -- CUID or custom ID
    "title"       TEXT     NOT NULL,                     -- Project name
    "description" TEXT,                                  -- Optional description
    "companyId"   TEXT     NOT NULL,                     -- FK → Company
    "managerId"   TEXT,                                  -- FK → User (project lead)
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL,

    CONSTRAINT "Project_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT "Project_managerId_fkey"
        FOREIGN KEY ("managerId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);


-- -------------------------------------------------------
-- TABLE: Task
-- Individual work items assigned to employees.
-- Tracks stage (Kanban), priority, deadline, and progress.
-- -------------------------------------------------------
CREATE TABLE "Task" (
    "id"          TEXT     NOT NULL PRIMARY KEY,         -- CUID or custom ID
    "title"       TEXT     NOT NULL,                     -- Task summary
    "description" TEXT,                                  -- Detailed description
    "priority"    TEXT     NOT NULL DEFAULT 'MEDIUM',    -- LOW | MEDIUM | HIGH | CRITICAL
    "deadline"    DATETIME,                              -- Optional due date
    "assigneeId"  TEXT,                                  -- FK → User (who does the work)
    "projectId"   TEXT     NOT NULL,                     -- FK → Project
    "stage"       TEXT     NOT NULL DEFAULT 'TODO',      -- TODO | IN_PROGRESS | REVIEW | DONE
    "progress"    INTEGER  NOT NULL DEFAULT 0,           -- 0 – 100 percentage
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL,

    CONSTRAINT "Task_assigneeId_fkey"
        FOREIGN KEY ("assigneeId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT "Task_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);


-- -------------------------------------------------------
-- TABLE: Activity
-- Audit log of actions on tasks (created, stage changed, etc.)
-- -------------------------------------------------------
CREATE TABLE "Activity" (
    "id"        TEXT     NOT NULL PRIMARY KEY,           -- CUID identifier
    "taskId"    TEXT     NOT NULL,                       -- FK → Task (cascade delete)
    "userId"    TEXT     NOT NULL,                       -- FK → User (who performed action)
    "action"    TEXT     NOT NULL,                       -- Human-readable action description
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_taskId_fkey"
        FOREIGN KEY ("taskId") REFERENCES "Task" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "Activity_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);


-- -------------------------------------------------------
-- TABLE: Alert
-- Real-time notifications sent from admins/managers to employees.
-- Delivered via Socket.io with sound, vibration, and full-screen modal.
-- -------------------------------------------------------
CREATE TABLE "Alert" (
    "id"          TEXT     NOT NULL PRIMARY KEY,         -- CUID identifier
    "type"        TEXT     NOT NULL,                     -- URGENT_TASK | DEADLINE_WARNING | MANAGER_CALL
    "title"       TEXT     NOT NULL,                     -- Alert headline
    "message"     TEXT     NOT NULL,                     -- Alert body
    "senderId"    TEXT     NOT NULL,                     -- FK → User (sender)
    "recipientId" TEXT     NOT NULL,                     -- FK → User (receiver)
    "read"        BOOLEAN  NOT NULL DEFAULT false,       -- Has the employee acknowledged it?
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_senderId_fkey"
        FOREIGN KEY ("senderId") REFERENCES "User" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT "Alert_recipientId_fkey"
        FOREIGN KEY ("recipientId") REFERENCES "User" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);


-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE UNIQUE INDEX "User_email_key"     ON "User"("email");
CREATE UNIQUE INDEX "Company_ownerId_key" ON "Company"("ownerId");

-- Performance indexes (recommended)
CREATE INDEX "Task_assigneeId_idx"  ON "Task"("assigneeId");
CREATE INDEX "Task_projectId_idx"   ON "Task"("projectId");
CREATE INDEX "Task_stage_idx"       ON "Task"("stage");
CREATE INDEX "Activity_taskId_idx"  ON "Activity"("taskId");
CREATE INDEX "Alert_recipientId_idx" ON "Alert"("recipientId");
CREATE INDEX "Alert_senderId_idx"   ON "Alert"("senderId");
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");
CREATE INDEX "User_companyId_idx"   ON "User"("companyId");


-- ============================================================
-- 3. SEED DATA (Demo accounts & sample content)
--    All passwords are bcrypt hash of "password123"
-- ============================================================

-- Password hash for "password123" (bcrypt, 12 rounds)
-- $2a$12$LJ3m4uB9hFwJGfOQhXSjLuXnES8YHKoN8Q7t7fZluZzRtA2mTpKJy

-- 3a. Users
INSERT INTO "User" ("id", "name", "email", "password", "role", "companyId", "createdAt", "updatedAt") VALUES
('user-owner-001',    'Alex Johnson',  'owner@taskforce.com',    '$2a$12$LJ3m4uB9hFwJGfOQhXSjLuXnES8YHKoN8Q7t7fZluZzRtA2mTpKJy', 'OWNER',    'company-001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user-manager-001',  'Sarah Chen',    'manager@taskforce.com',  '$2a$12$LJ3m4uB9hFwJGfOQhXSjLuXnES8YHKoN8Q7t7fZluZzRtA2mTpKJy', 'MANAGER',  'company-001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user-emp-001',      'Mike Rivera',   'emp1@taskforce.com',     '$2a$12$LJ3m4uB9hFwJGfOQhXSjLuXnES8YHKoN8Q7t7fZluZzRtA2mTpKJy', 'EMPLOYEE', 'company-001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user-emp-002',      'Priya Patel',   'emp2@taskforce.com',     '$2a$12$LJ3m4uB9hFwJGfOQhXSjLuXnES8YHKoN8Q7t7fZluZzRtA2mTpKJy', 'EMPLOYEE', 'company-001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3b. Company
INSERT INTO "Company" ("id", "name", "ownerId", "createdAt") VALUES
('company-001', 'TaskForce Inc.', 'user-owner-001', CURRENT_TIMESTAMP);

-- 3c. Projects
INSERT INTO "Project" ("id", "title", "description", "companyId", "managerId", "createdAt", "updatedAt") VALUES
('proj-001', 'Website Redesign',  'Full company website overhaul',  'company-001', 'user-manager-001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('proj-002', 'Mobile App Launch', 'Q2 mobile app release',          'company-001', 'user-manager-001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3d. Tasks
INSERT INTO "Task" ("id", "title", "description", "priority", "deadline", "assigneeId", "projectId", "stage", "progress", "createdAt", "updatedAt") VALUES
('task-001', 'Design new landing page',        'Design new landing page — detailed implementation task',         'HIGH',     datetime('now', '+3 days'),  'user-emp-001', 'proj-001', 'IN_PROGRESS', 40,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('task-002', 'Fix navigation bug',             'Fix navigation bug — detailed implementation task',              'CRITICAL', datetime('now', '+1 day'),   'user-emp-001', 'proj-001', 'TODO',        0,   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('task-003', 'Write API documentation',        'Write API documentation — detailed implementation task',         'MEDIUM',   datetime('now', '+7 days'),  'user-emp-002', 'proj-002', 'REVIEW',      75,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('task-004', 'Implement push notifications',   'Implement push notifications — detailed implementation task',    'HIGH',     datetime('now', '-2 days'),  'user-emp-002', 'proj-002', 'DONE',        100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('task-005', 'User testing session setup',     'User testing session setup — detailed implementation task',      'LOW',      datetime('now', '+14 days'), 'user-emp-001', 'proj-002', 'TODO',        0,   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3e. Activity log
INSERT INTO "Activity" ("id", "taskId", "userId", "action", "createdAt") VALUES
('act-001', 'task-001', 'user-emp-001', 'Task created',    CURRENT_TIMESTAMP),
('act-002', 'task-002', 'user-emp-001', 'Task created',    CURRENT_TIMESTAMP),
('act-003', 'task-003', 'user-emp-002', 'Task created',    CURRENT_TIMESTAMP),
('act-004', 'task-004', 'user-emp-002', 'Task completed',  CURRENT_TIMESTAMP),
('act-005', 'task-005', 'user-emp-001', 'Task created',    CURRENT_TIMESTAMP);

-- 3f. Sample alerts
INSERT INTO "Alert" ("id", "type", "title", "message", "senderId", "recipientId", "read", "createdAt") VALUES
('alert-001', 'URGENT_TASK',       'Critical bug on production',  'The login page is broken for some users. Please fix ASAP.',       'user-owner-001',   'user-emp-001', false, CURRENT_TIMESTAMP),
('alert-002', 'DEADLINE_WARNING',  'Deadline approaching',        'The API documentation is due in 2 days. Please submit for review.', 'user-manager-001', 'user-emp-002', false, CURRENT_TIMESTAMP),
('alert-003', 'MANAGER_CALL',      'Quick sync needed',           'Please join a quick call when you are free. We need to discuss the mobile app timeline.', 'user-manager-001', 'user-emp-001', true, CURRENT_TIMESTAMP);


-- ============================================================
-- 4. ENTITY RELATIONSHIP SUMMARY
-- ============================================================
--
--  User ──1:1──▶ Company (as owner)
--  User ──N:1──▶ Company (as member)
--  User ──1:N──▶ Project (as manager)
--  User ──1:N──▶ Task    (as assignee)
--  User ──1:N──▶ Activity
--  User ──1:N──▶ Alert   (as sender)
--  User ──1:N──▶ Alert   (as recipient)
--
--  Company ──1:N──▶ Project
--  Project ──1:N──▶ Task
--  Task    ──1:N──▶ Activity
--
-- ============================================================
-- 5. ROLE-BASED ACCESS CONTROL (RBAC)
-- ============================================================
--
--  ┌──────────┬────────────────────────────────────────────────┐
--  │ Role     │ Permissions                                    │
--  ├──────────┼────────────────────────────────────────────────┤
--  │ OWNER    │ Full CRUD on all resources, manage company,    │
--  │          │ add/remove members, send alerts, view analytics│
--  ├──────────┼────────────────────────────────────────────────┤
--  │ MANAGER  │ CRUD projects & tasks, send alerts to          │
--  │          │ employees, view team performance               │
--  ├──────────┼────────────────────────────────────────────────┤
--  │ EMPLOYEE │ View assigned tasks, advance task stage,       │
--  │          │ view own alerts & progress                     │
--  └──────────┴────────────────────────────────────────────────┘
--
-- ============================================================
-- 6. TASK STAGE LIFECYCLE (Kanban)
-- ============================================================
--
--   TODO ──▶ IN_PROGRESS ──▶ REVIEW ──▶ DONE
--
--   Progress auto-mapping:
--     TODO         →   0%
--     IN_PROGRESS  →  40%
--     REVIEW       →  75%
--     DONE         → 100%
--
-- ============================================================
-- 7. ALERT TYPES
-- ============================================================
--
--   URGENT_TASK       – Immediate action required (red)
--   DEADLINE_WARNING  – Approaching deadline (amber)
--   MANAGER_CALL      – Request for a callback (blue)
--
--   Delivery: Real-time via Socket.io with:
--     • Audio chime
--     • Device vibration
--     • Full-screen modal overlay
--     • Browser push notification
--
-- ============================================================
