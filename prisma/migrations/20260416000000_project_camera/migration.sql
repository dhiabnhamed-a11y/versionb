-- CreateEnum
CREATE TYPE "CameraType" AS ENUM ('device', 'external');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "hasCamera" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "cameraType" "CameraType" NOT NULL DEFAULT 'device';

-- CreateTable
CREATE TABLE "ProjectCameraMedia" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCameraMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectCameraMedia_projectId_idx" ON "ProjectCameraMedia"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectCameraMedia" ADD CONSTRAINT "ProjectCameraMedia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
