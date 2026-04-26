-- ============================================================
-- Old Toby Academy — Phase 14: tokens can carry any role
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent.
--
-- Today the invite_tokens.role column has a CHECK constraint
-- limiting it to ('student', 'faculty'). With dynamic RBAC we
-- want headmaster to mint tokens for any existing role
-- (e.g. 'concert-conductor'). This migration:
--
--   1. Drops the old CHECK
--   2. Replaces generate_invite_token() to validate the requested
--      role against the roles table (so typos / nonexistent slugs
--      still fail fast — just no longer hardcoded)
--   3. Records itself in schema_migrations
-- ============================================================

-- 1) Drop the old CHECK constraint. Idempotent.
alter table public.invite_tokens
  drop constraint if exists invite_tokens_role_check;

-- 2) generate_invite_token — validates against roles table now.
create or replace function public.generate_invite_token(
  p_role         text,
  p_expires_days int  default 30,
  p_notes        text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_token  text;
  v_exists boolean;
begin
  if not public.is_headmaster() then
    raise exception 'only headmaster can generate tokens';
  end if;

  -- Role must exist. Don't restrict to system roles — custom roles
  -- created in /admin/roles are valid token targets.
  select exists (select 1 from public.roles where slug = p_role)
    into v_exists;

  if not v_exists then
    raise exception 'role % does not exist', p_role;
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.invite_tokens (token, role, expires_at, notes, created_by)
  values (
    v_token,
    p_role,
    case when p_expires_days > 0 then now() + (p_expires_days || ' days')::interval else null end,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_caller
  );

  return v_token;
end;
$$;

grant execute on function public.generate_invite_token(text, int, text) to authenticated;

-- 3) Mark this migration applied
insert into public.schema_migrations (filename) values ('phase14.sql')
on conflict (filename) do nothing;
