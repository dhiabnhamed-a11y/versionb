-- Client portal token expiry: tokens now expire after 180 days by default.
-- Existing tokens with NULL expiry continue to work until rotated.

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "portalTokenExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Client_portalTokenExpiresAt_idx"
  ON "Client"("portalTokenExpiresAt")
  WHERE "portalEnabled" = true;
