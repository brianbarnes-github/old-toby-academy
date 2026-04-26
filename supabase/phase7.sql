-- ============================================================
-- Old Toby Academy — Phase 7A migration: dynamic RBAC schema
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent. No data loss.
--
-- Site behaviour after this migration is unchanged: the existing
-- middleware + RLS policies still gate admin via is_headmaster(),
-- which is now a thin wrapper around has_permission('admin.access').
-- ============================================================

-- ----------------------------------------------------------
-- Tables
-- ----------------------------------------------------------
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  is_system   boolean not null default false,
  created_by  uuid references auth.users,
  created_at  timestamptz not null default now()
);

create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  area        text not null,
  action      text not null,
  description text,
  is_system   boolean not null default true
);

create table if not exists public.role_permissions (
  role_id       uuid references public.roles       on delete cascade,
  permission_id uuid references public.permissions on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id    uuid references auth.users  on delete cascade,
  role_id    uuid references public.roles on delete cascade,
  granted_by uuid references auth.users,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists user_roles_role_id_idx on public.user_roles (role_id);
create index if not exists role_permissions_role_id_idx on public.role_permissions (role_id);

-- ----------------------------------------------------------
-- Seed: system roles
-- ----------------------------------------------------------
insert into public.roles (slug, name, description, is_system)
values
  ('student',    'Student',    'Default role for token signups. Reads gated content.',                 true),
  ('faculty',    'Faculty',    'Instructors. Reserved for content authoring + grading (future work).', true),
  ('headmaster', 'Headmaster', 'Full administrative authority over the academy.',                      true)
on conflict (slug) do update
  set name        = excluded.name,
      description = excluded.description,
      is_system   = excluded.is_system;

-- ----------------------------------------------------------
-- Seed: permission catalog
-- ----------------------------------------------------------
insert into public.permissions (slug, area, action, description, is_system)
values
  ('admin.access',       'admin',  'access',       'Reach any /admin/* page',                                  true),
  ('tokens.list',        'tokens', 'list',         'View the invite-token table',                              true),
  ('tokens.mint',        'tokens', 'mint',         'Generate new invite tokens',                               true),
  ('tokens.revoke',      'tokens', 'revoke',       'Revoke active invite tokens',                              true),
  ('audit.read',         'audit',  'read',         'View the audit log',                                       true),
  ('users.list',         'users',  'list',         'View the member roster',                                   true),
  ('users.assign_roles', 'users',  'assign_roles', 'Add or remove roles on any member',                        true),
  ('roles.manage',       'roles',  'manage',       'Create, edit, delete roles + their permission bundles',    true)
on conflict (slug) do update
  set area        = excluded.area,
      action      = excluded.action,
      description = excluded.description,
      is_system   = excluded.is_system;

-- ----------------------------------------------------------
-- Seed: default role → permission bundles
-- headmaster gets every is_system permission.
-- student/faculty get nothing (yet) — gated content access doesn't
-- require a permission today; rules-acceptance gate already covers it.
-- ----------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r, public.permissions p
 where r.slug = 'headmaster'
   and p.is_system = true
on conflict do nothing;

-- ----------------------------------------------------------
-- has_permission(slug) — the new authority check
-- ----------------------------------------------------------
create or replace function public.has_permission(p_slug text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions       p on p.id       = rp.permission_id
     where ur.user_id = auth.uid()
       and p.slug     = p_slug
  );
$$;

grant execute on function public.has_permission(text) to authenticated;

-- ----------------------------------------------------------
-- is_headmaster() — wrap has_permission so existing RLS policies
-- + SECURITY DEFINER functions keep working without modification.
-- ----------------------------------------------------------
create or replace function public.is_headmaster()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.has_permission('admin.access');
$$;

-- ----------------------------------------------------------
-- Drop the legacy CHECK on profiles.role: with custom roles,
-- the column should accept any role slug, not just the original three.
-- ----------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;

-- ----------------------------------------------------------
-- Trigger: keep profiles.role in sync with user_roles.
-- profiles.role becomes a denormalized "primary role" used by the
-- masthead. Precedence: headmaster > faculty > student > custom (alpha).
-- ----------------------------------------------------------
create or replace function public.sync_primary_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role    text;
begin
  v_user_id := coalesce(new.user_id, old.user_id);

  select r.slug into v_role
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
   where ur.user_id = v_user_id
   order by case r.slug
              when 'headmaster' then 1
              when 'faculty'    then 2
              when 'student'    then 3
              else 4
            end,
            r.slug
   limit 1;

  if v_role is not null then
    update public.profiles set role = v_role where user_id = v_user_id;
  end if;

  return null;
end;
$$;

drop trigger if exists user_roles_sync_primary_role on public.user_roles;
create trigger user_roles_sync_primary_role
  after insert or delete on public.user_roles
  for each row execute function public.sync_primary_role();

-- ----------------------------------------------------------
-- redeem_token: also INSERT INTO user_roles so the new RBAC
-- system reflects the granted role. The trigger above syncs
-- profiles.role afterwards.
-- ----------------------------------------------------------
create or replace function public.redeem_token(
  p_token     text,
  p_character text default null,
  p_server    text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    text;
  v_role_id uuid;
  v_caller  uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'must be authenticated';
  end if;

  select role into v_role
    from public.invite_tokens
   where token = p_token
     and used_at    is null
     and revoked_at is null
     and (expires_at is null or expires_at > now())
     for update;

  if v_role is null then
    raise exception 'invalid or expired token';
  end if;

  -- Find the role row matching the token's role string
  select id into v_role_id from public.roles where slug = v_role;
  if v_role_id is null then
    raise exception 'role % not configured in roles table', v_role;
  end if;

  update public.invite_tokens
     set used_at = now(), used_by = v_caller
   where token = p_token;

  update public.profiles
     set role           = v_role,
         character_name = coalesce(p_character, character_name),
         server         = coalesce(p_server, server)
   where user_id = v_caller;

  -- New: also grant the role via the dynamic-RBAC table
  insert into public.user_roles (user_id, role_id, granted_by)
  values (v_caller, v_role_id, v_caller)
  on conflict do nothing;

  insert into public.entries (user_id, event_type, details)
  values (
    v_caller,
    'token_redeemed',
    jsonb_build_object(
      'token',          p_token,
      'role',           v_role,
      'character_name', p_character,
      'server',         p_server
    )
  );

  return v_role;
end;
$$;

grant execute on function public.redeem_token(text, text, text) to authenticated;

-- ----------------------------------------------------------
-- Backfill: ensure every existing profile has a corresponding
-- user_roles row matching its profiles.role string.
-- ----------------------------------------------------------
insert into public.user_roles (user_id, role_id)
select p.user_id, r.id
  from public.profiles p
  join public.roles    r on r.slug = p.role
 where not exists (
   select 1 from public.user_roles ur
    where ur.user_id = p.user_id and ur.role_id = r.id
 );

-- ----------------------------------------------------------
-- RLS for the new tables
-- ----------------------------------------------------------
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles       enable row level security;

-- Anyone authenticated can READ roles/permissions/role_permissions —
-- the catalogs are not secret, and reads power UI badges + masthead.
drop policy if exists "authenticated reads roles"            on public.roles;
drop policy if exists "authenticated reads permissions"      on public.permissions;
drop policy if exists "authenticated reads role_permissions" on public.role_permissions;
drop policy if exists "self reads own user_roles"            on public.user_roles;
drop policy if exists "headmaster reads all user_roles"      on public.user_roles;
drop policy if exists "headmaster manages roles"             on public.roles;
drop policy if exists "headmaster manages role_permissions"  on public.role_permissions;
drop policy if exists "headmaster manages user_roles"        on public.user_roles;

create policy "authenticated reads roles"
  on public.roles for select using (auth.uid() is not null);

create policy "authenticated reads permissions"
  on public.permissions for select using (auth.uid() is not null);

create policy "authenticated reads role_permissions"
  on public.role_permissions for select using (auth.uid() is not null);

create policy "self reads own user_roles"
  on public.user_roles for select using (auth.uid() = user_id);

-- has_permission gates write access — Phase B handlers will use these.
create policy "headmaster reads all user_roles"
  on public.user_roles for select using (public.has_permission('users.list'));

create policy "headmaster manages user_roles"
  on public.user_roles for all
  using (public.has_permission('users.assign_roles'))
  with check (public.has_permission('users.assign_roles'));

create policy "headmaster manages roles"
  on public.roles for all
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

create policy "headmaster manages role_permissions"
  on public.role_permissions for all
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));
