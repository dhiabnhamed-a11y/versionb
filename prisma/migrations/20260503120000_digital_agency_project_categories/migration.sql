CREATE TABLE "ProjectCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "companyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectCategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Project"
ADD COLUMN "categoryId" TEXT,
ADD COLUMN "clientName" TEXT;

CREATE INDEX "ProjectCategory_companyId_createdAt_idx" ON "ProjectCategory"("companyId", "createdAt");
CREATE UNIQUE INDEX "ProjectCategory_companyId_name_key" ON "ProjectCategory"("companyId", "name");
CREATE INDEX "Project_companyId_categoryId_idx" ON "Project"("companyId", "categoryId");

ALTER TABLE "ProjectCategory"
ADD CONSTRAINT "ProjectCategory_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "ProjectCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
