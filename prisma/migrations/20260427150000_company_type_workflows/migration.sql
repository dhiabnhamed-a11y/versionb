-- Add company type so workspaces can branch into industry, agency, or other flows
ALTER TABLE "Company"
ADD COLUMN "companyType" TEXT NOT NULL DEFAULT 'OTHER';

-- Industry workspaces can group projects into rooms
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Room_companyId_createdAt_idx" ON "Room"("companyId", "createdAt");

ALTER TABLE "Room"
ADD CONSTRAINT "Room_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD COLUMN "roomId" TEXT;

CREATE INDEX "Project_companyId_roomId_idx" ON "Project"("companyId", "roomId");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Digital agency tasks can carry a deliverable type and uploaded submissions
ALTER TABLE "Task"
ADD COLUMN "deliverableType" TEXT NOT NULL DEFAULT 'GENERAL';

CREATE TABLE "TaskSubmission" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskSubmission_taskId_createdAt_idx" ON "TaskSubmission"("taskId", "createdAt");
CREATE INDEX "TaskSubmission_userId_createdAt_idx" ON "TaskSubmission"("userId", "createdAt");

ALTER TABLE "TaskSubmission"
ADD CONSTRAINT "TaskSubmission_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskSubmission"
ADD CONSTRAINT "TaskSubmission_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
