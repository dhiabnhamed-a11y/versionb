CREATE TABLE "UserDashboardDesign" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT,
  "sourceType" TEXT NOT NULL DEFAULT 'json',
  "designJson" JSONB,
  "customCss" TEXT,
  "compiledCss" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserDashboardDesign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserDashboardDesign_userId_key" ON "UserDashboardDesign"("userId");

ALTER TABLE "UserDashboardDesign"
  ADD CONSTRAINT "UserDashboardDesign_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
