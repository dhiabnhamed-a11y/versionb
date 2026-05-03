-- Cloudinary media library for digital agency campaigns.
-- API/UI code gates all access to Company.companyType = 'DIGITAL_AGENCY'.

CREATE TABLE "ProjectMedia" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "playbackUrl" TEXT,
    "thumbnailUrl" TEXT,
    "cloudinaryPublicId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectMedia_projectId_createdAt_idx" ON "ProjectMedia"("projectId", "createdAt");
CREATE INDEX "ProjectMedia_uploadedById_createdAt_idx" ON "ProjectMedia"("uploadedById", "createdAt");
CREATE INDEX "ProjectMedia_projectId_type_createdAt_idx" ON "ProjectMedia"("projectId", "type", "createdAt");

ALTER TABLE "ProjectMedia"
ADD CONSTRAINT "ProjectMedia_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMedia"
ADD CONSTRAINT "ProjectMedia_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskSubmission"
ADD COLUMN "mediaType" TEXT,
ADD COLUMN "fileSize" INTEGER,
ADD COLUMN "duration" DOUBLE PRECISION,
ADD COLUMN "thumbnailUrl" TEXT,
ADD COLUMN "playbackUrl" TEXT,
ADD COLUMN "cloudinaryPublicId" TEXT;

