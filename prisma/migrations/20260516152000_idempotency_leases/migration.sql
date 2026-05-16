ALTER TABLE "idempotency_keys"
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "idempotency_keys_companyId_status_lockedUntil_idx"
  ON "idempotency_keys"("companyId", "status", "lockedUntil");
