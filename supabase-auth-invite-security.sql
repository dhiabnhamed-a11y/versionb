-- TASKIT invite-only Supabase hardening
--
-- Apply after the Prisma migration that adds:
--   - public."Invite"
--   - public."User"."authUserId"
--   - public."Company"."emailDomain"
--   - public."AccessRequest"
--
-- Then configure the Supabase "Before User Created" hook to:
--   pg-functions://postgres/public/taskit_before_user_created
--
-- Official references:
-- - Supabase Before User Created Hook:
--   https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
-- - Supabase Auth Hooks:
--   https://supabase.com/docs/guides/auth/auth-hooks

grant usage on schema public to supabase_auth_admin;
grant select on public."Invite" to supabase_auth_admin;
grant select on public."User" to supabase_auth_admin;
grant select on public."Company" to supabase_auth_admin;

create or replace function public.taskit_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  signup_email text;
  signup_role text;
  signup_domain text;
  invite_code text;
  invite_id text;
  blocked_owner_domains text[] := array[
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'icloud.com',
    'me.com',
    'msn.com',
    'aol.com',
    'proton.me',
    'protonmail.com'
  ];
begin
  signup_email := lower(coalesce(event->'user'->>'email', ''));
  signup_role := upper(trim(coalesce(event->'user'->'user_metadata'->>'signup_role', '')));
  signup_domain := split_part(signup_email, '@', 2);
  invite_code := trim(coalesce(event->'user'->'user_metadata'->>'invite_code', ''));

  if signup_role = 'OWNER' then
    if signup_email = '' or signup_domain = '' then
      return jsonb_build_object(
        'error',
        jsonb_build_object(
          'http_code', 403,
          'message', 'Company email required for Owner.'
        )
      );
    end if;

    if signup_domain = any(blocked_owner_domains) then
      return jsonb_build_object(
        'error',
        jsonb_build_object(
          'http_code', 403,
          'message', 'Company email required for Owner.'
        )
      );
    end if;

    if exists (
      select 1
      from public."Company" c
      where lower(coalesce(c."emailDomain", '')) = signup_domain
    ) then
      return jsonb_build_object(
        'error',
        jsonb_build_object(
          'http_code', 409,
          'message', 'This company domain is already linked to TASKIT.'
        )
      );
    end if;

    return '{}'::jsonb;
  end if;

  if signup_role not in ('MANAGER', 'EMPLOYEE') or signup_email = '' or invite_code = '' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'TASKIT manager and employee accounts require a valid company invite.'
      )
    );
  end if;

  select i.id
    into invite_id
  from public."Invite" i
  where i.code = invite_code
    and lower(i."invitedEmail") = signup_email
    and upper(i."role") = signup_role
    and i."used" = false
    and i."usedAt" is null
    and i."expiresAt" > now()
  limit 1;

  if invite_id is null then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'This invite is invalid, expired, or already used.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant execute on function public.taskit_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.taskit_before_user_created(jsonb) from authenticated, anon, public;

create or replace function public.taskit_current_company_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u."companyId"
  from public."User" u
  where u."authUserId" = auth.uid()
  limit 1
$$;

create or replace function public.taskit_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u."role"
  from public."User" u
  where u."authUserId" = auth.uid()
  limit 1
$$;

grant execute on function public.taskit_current_company_id() to authenticated;
grant execute on function public.taskit_current_role() to authenticated;

alter table public."Company" enable row level security;
alter table public."User" enable row level security;
alter table public."Invite" enable row level security;
alter table public."AccessRequest" enable row level security;
alter table public."Project" enable row level security;
alter table public."Task" enable row level security;
alter table public."Activity" enable row level security;
alter table public."Alert" enable row level security;

drop policy if exists "taskit_company_select" on public."Company";
create policy "taskit_company_select"
on public."Company"
for select
to authenticated
using ("id" = public.taskit_current_company_id());

drop policy if exists "taskit_user_select" on public."User";
create policy "taskit_user_select"
on public."User"
for select
to authenticated
using ("companyId" = public.taskit_current_company_id());

drop policy if exists "taskit_user_update_self" on public."User";
create policy "taskit_user_update_self"
on public."User"
for update
to authenticated
using ("authUserId" = auth.uid())
with check ("authUserId" = auth.uid());

drop policy if exists "taskit_invite_admin_read" on public."Invite";
create policy "taskit_invite_admin_read"
on public."Invite"
for select
to authenticated
using (
  "companyId" = public.taskit_current_company_id()
  and public.taskit_current_role() in ('OWNER', 'MANAGER')
);

drop policy if exists "taskit_invite_owner_insert" on public."Invite";
create policy "taskit_invite_owner_insert"
on public."Invite"
for insert
to authenticated
with check (
  "companyId" = public.taskit_current_company_id()
  and (
    public.taskit_current_role() = 'OWNER'
    or (public.taskit_current_role() = 'MANAGER' and "role" = 'EMPLOYEE')
  )
);

drop policy if exists "taskit_access_request_admin_read" on public."AccessRequest";
create policy "taskit_access_request_admin_read"
on public."AccessRequest"
for select
to authenticated
using (
  "companyId" = public.taskit_current_company_id()
  and public.taskit_current_role() in ('OWNER', 'MANAGER')
);

drop policy if exists "taskit_access_request_admin_update" on public."AccessRequest";
create policy "taskit_access_request_admin_update"
on public."AccessRequest"
for update
to authenticated
using (
  "companyId" = public.taskit_current_company_id()
  and public.taskit_current_role() in ('OWNER', 'MANAGER')
)
with check (
  "companyId" = public.taskit_current_company_id()
  and public.taskit_current_role() in ('OWNER', 'MANAGER')
);

drop policy if exists "taskit_project_company_read" on public."Project";
create policy "taskit_project_company_read"
on public."Project"
for select
to authenticated
using ("companyId" = public.taskit_current_company_id());

drop policy if exists "taskit_task_company_read" on public."Task";
create policy "taskit_task_company_read"
on public."Task"
for select
to authenticated
using (
  exists (
    select 1
    from public."Project" p
    where p."id" = "projectId"
      and p."companyId" = public.taskit_current_company_id()
  )
);

drop policy if exists "taskit_activity_company_read" on public."Activity";
create policy "taskit_activity_company_read"
on public."Activity"
for select
to authenticated
using (
  exists (
    select 1
    from public."Task" t
    join public."Project" p on p."id" = t."projectId"
    where t."id" = "taskId"
      and p."companyId" = public.taskit_current_company_id()
  )
);

drop policy if exists "taskit_alert_company_read" on public."Alert";
create policy "taskit_alert_company_read"
on public."Alert"
for select
to authenticated
using (
  exists (
    select 1
    from public."User" recipient
    where recipient."id" = "recipientId"
      and recipient."companyId" = public.taskit_current_company_id()
  )
);
