CREATE TABLE "auth_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT,
  "sessionTokenHash" TEXT,
  "refreshTokenHash" TEXT,
  "jti" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "deviceFingerprint" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "forcedLogoutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "revoked_tokens" (
  "id" TEXT NOT NULL,
  "jti" TEXT NOT NULL,
  "userId" TEXT,
  "companyId" TEXT,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mfa_factors" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'TOTP',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "secretCiphertext" TEXT,
  "label" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mfa_recovery_codes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_login_attempts" (
  "id" TEXT NOT NULL,
  "emailHash" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_login_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "security_nonces" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "namespace" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_nonces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_sessions_sessionTokenHash_key" ON "auth_sessions"("sessionTokenHash");
CREATE UNIQUE INDEX "auth_sessions_refreshTokenHash_key" ON "auth_sessions"("refreshTokenHash");
CREATE UNIQUE INDEX "auth_sessions_jti_key" ON "auth_sessions"("jti");
CREATE INDEX "auth_sessions_userId_status_lastSeenAt_idx" ON "auth_sessions"("userId", "status", "lastSeenAt");
CREATE INDEX "auth_sessions_companyId_status_lastSeenAt_idx" ON "auth_sessions"("companyId", "status", "lastSeenAt");
CREATE INDEX "auth_sessions_status_expiresAt_idx" ON "auth_sessions"("status", "expiresAt");
CREATE INDEX "auth_sessions_deviceFingerprint_status_idx" ON "auth_sessions"("deviceFingerprint", "status");

CREATE UNIQUE INDEX "revoked_tokens_jti_key" ON "revoked_tokens"("jti");
CREATE INDEX "revoked_tokens_userId_revokedAt_idx" ON "revoked_tokens"("userId", "revokedAt");
CREATE INDEX "revoked_tokens_companyId_revokedAt_idx" ON "revoked_tokens"("companyId", "revokedAt");
CREATE INDEX "revoked_tokens_expiresAt_idx" ON "revoked_tokens"("expiresAt");

CREATE INDEX "mfa_factors_userId_status_type_idx" ON "mfa_factors"("userId", "status", "type");

CREATE UNIQUE INDEX "mfa_recovery_codes_userId_codeHash_key" ON "mfa_recovery_codes"("userId", "codeHash");
CREATE INDEX "mfa_recovery_codes_userId_usedAt_idx" ON "mfa_recovery_codes"("userId", "usedAt");

CREATE INDEX "auth_login_attempts_emailHash_createdAt_idx" ON "auth_login_attempts"("emailHash", "createdAt");
CREATE INDEX "auth_login_attempts_ipAddress_createdAt_idx" ON "auth_login_attempts"("ipAddress", "createdAt");
CREATE INDEX "auth_login_attempts_success_createdAt_idx" ON "auth_login_attempts"("success", "createdAt");

CREATE UNIQUE INDEX "security_nonces_namespace_nonceHash_key" ON "security_nonces"("namespace", "nonceHash");
CREATE INDEX "security_nonces_companyId_namespace_createdAt_idx" ON "security_nonces"("companyId", "namespace", "createdAt");
CREATE INDEX "security_nonces_expiresAt_idx" ON "security_nonces"("expiresAt");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revoked_tokens" ADD CONSTRAINT "revoked_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "revoked_tokens" ADD CONSTRAINT "revoked_tokens_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_nonces" ADD CONSTRAINT "security_nonces_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
