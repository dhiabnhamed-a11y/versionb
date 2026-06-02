-- EMS Row Level Security (RLS) — HIPAA §164.312(a)(1)
-- Prevents any direct database connection (anon/authenticated Supabase roles)
-- from bypassing app-level authorization checks.
-- Prisma uses the service_role which automatically bypasses RLS in Supabase.
--
-- Apply: Run against your Supabase project via the SQL Editor or psql.
-- Note: This does NOT break Prisma — service_role bypasses RLS by default.
-- Note: Every ALTER TABLE is guarded — tables that don't exist yet are skipped.

-- ============================================================
-- Helper: enable RLS + deny policies only if the table exists
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'EmsCompany','EmsStation','EmsUnit','EmsUnitLocation','EmsCrew','EmsCrewMember',
    'EmsDispatcher','EmsHospital','EmsIncident','EmsAssignment','EmsPatient',
    'EmsIncidentTimeline','EmsCommunication','EmsIncidentMedia','EmsIncidentNote',
    'EmsDispatchLog','EmsAiDecision','EmsUnitMaintenance','EmsProtocol',
    'EmsAutomationRule','EmsWorkflowExecution','EmsSupplyStock','EmsNotification',
    'EmsAnalytics','EmsPredictiveZone','EmsIntegration','EmsWebhookConfig',
    'EmsFieldMapping','EmsIntegrationEvent','EmsAuditLog'
  ];
  tbl_exists BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- Check if table exists in the current schema
    SELECT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = current_schema()
        AND tablename = tbl
    ) INTO tbl_exists;

    IF NOT tbl_exists THEN
      RAISE NOTICE 'Skipping % — table does not exist yet', tbl;
      CONTINUE;
    END IF;

    -- Enable RLS
    EXECUTE format('ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY', tbl);

    -- Deny anon role (anonymous Supabase connections)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = current_schema()
        AND tablename = tbl
        AND policyname = format('deny_anon_%s', tbl)
    ) THEN
      EXECUTE format(
        'CREATE POLICY "deny_anon_%s" ON "%s" AS RESTRICTIVE FOR ALL TO anon USING (false)',
        tbl, tbl
      );
    END IF;

    -- Deny authenticated role (direct Supabase client connections bypassing app)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = current_schema()
        AND tablename = tbl
        AND policyname = format('deny_authenticated_direct_%s', tbl)
    ) THEN
      EXECUTE format(
        'CREATE POLICY "deny_authenticated_direct_%s" ON "%s" AS RESTRICTIVE FOR ALL TO authenticated USING (false)',
        tbl, tbl
      );
    END IF;

    RAISE NOTICE 'RLS enabled on %', tbl;
  END LOOP;
END $$;

-- ============================================================
-- Immutable audit log — trigger blocks UPDATE/DELETE even by service_role
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = current_schema() AND tablename = 'EmsAuditLog'
  ) THEN
    CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
    RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
    BEGIN
      RAISE EXCEPTION 'EmsAuditLog records are immutable — DELETE and UPDATE are not permitted (HIPAA §164.312(b))';
    END;
    $fn$;

    DROP TRIGGER IF EXISTS audit_log_immutable ON "EmsAuditLog";
    CREATE TRIGGER audit_log_immutable
      BEFORE UPDATE OR DELETE ON "EmsAuditLog"
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

    RAISE NOTICE 'Immutable trigger applied to EmsAuditLog';
  ELSE
    RAISE NOTICE 'Skipping EmsAuditLog trigger — table does not exist yet';
  END IF;
END $$;

-- ============================================================
-- Audit log indexes (applied only if table exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = current_schema() AND tablename = 'EmsAuditLog'
  ) THEN
    CREATE INDEX IF NOT EXISTS "EmsAuditLog_companyId_containsPhi_idx"
      ON "EmsAuditLog"("companyId", "containsPhi");
    CREATE INDEX IF NOT EXISTS "EmsAuditLog_actorId_timestamp_idx"
      ON "EmsAuditLog"("actorId", "timestamp");
    CREATE INDEX IF NOT EXISTS "EmsAuditLog_resourceId_idx"
      ON "EmsAuditLog"("resourceId");
    RAISE NOTICE 'EmsAuditLog indexes created';
  END IF;
END $$;
