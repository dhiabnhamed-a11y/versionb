-- CreateTable
CREATE TABLE "ProjectCamera" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 554,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "rtspPath" TEXT NOT NULL DEFAULT '/stream',
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "lastStartedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCamera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCamera_projectId_key" ON "ProjectCamera"("projectId");

-- CreateIndex
CREATE INDEX "ProjectCamera_projectId_status_idx" ON "ProjectCamera"("projectId", "status");

-- AddForeignKey
ALTER TABLE "ProjectCamera" ADD CONSTRAINT "ProjectCamera_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
