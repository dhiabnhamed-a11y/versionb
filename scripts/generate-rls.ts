import { writeFileSync } from 'fs'
import { TENANT_SCOPED_MODELS } from '../src/lib/tenant/tenant-models'

const tables = Array.from(TENANT_SCOPED_MODELS).map(model => `'"${model}"'`).join(',\n    ')

const sql = `-- 1. Create the application role
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'taskit_app') THEN
    CREATE ROLE taskit_app NOINHERIT LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO taskit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO taskit_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taskit_app;

-- 2. Helper function
CREATE OR REPLACE FUNCTION current_company_id() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER
  AS $func$ SELECT current_setting('app.current_company_id', true) $func$;

-- 3. Bypass function for Super Admin
CREATE OR REPLACE FUNCTION is_super_admin_context() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  AS $func$ SELECT current_setting('app.current_company_id', true) = 'SUPER_ADMIN' $func$;

-- 4. Apply policies to ALL tenant-scoped tables
DO $$ 
DECLARE
  tables text[] := ARRAY[
    ${tables}
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %s FOR ALL TO taskit_app USING (is_super_admin_context() OR "companyId" IS NULL OR "companyId" = current_company_id()) WITH CHECK (is_super_admin_context() OR "companyId" = current_company_id())', t);
  END LOOP;
END $$;
`

writeFileSync('./prisma/rls/tenant-policies-v2.sql', sql)
console.log('RLS policies generated to prisma/rls/tenant-policies-v2.sql')
