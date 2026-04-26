-- ============================================================
-- Old Toby Academy — Phase 7B migration: admin RBAC helpers
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent. Adds SECURITY DEFINER functions that
-- back the /admin/users and /admin/roles UI mutations.
-- ============================================================

-- ----------------------------------------------------------
-- admin_grant_role(target_user_id, role_id) → boolean
-- ----------------------------------------------------------
create or replace function public.admin_grant_role(p_target uuid, p_role_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller    uuid := auth.uid();
  v_role_slug text;
  v_inserted  int;
begin
  if not public.has_permission('users.assign_roles') then
    raise exception 'permission denied: users.assign_roles required';
  end if;

  select slug into v_role_slug from public.roles where id = p_role_id;
  if v_role_slug is null then
    raise exception 'role not found';
  end if;

  insert into public.user_roles (user_id, role_id, granted_by)
  values (p_target, p_role_id, v_caller)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    insert into public.entries (user_id, event_type, details)
    values (
      v_caller,
      'role_granted',
      jsonb_build_object('role_slug', v_role_slug, 'target_user_id', p_target)
    );
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.admin_grant_role(uuid, uuid) to authenticated;

-- ----------------------------------------------------------
-- admin_revoke_role(target_user_id, role_id) → boolean
-- ----------------------------------------------------------
create or replace function public.admin_revoke_role(p_target uuid, p_role_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller    uuid := auth.uid();
  v_role_slug text;
  v_deleted   int;
begin
  if not public.has_permission('users.assign_roles') then
    raise exception 'permission denied: users.assign_roles required';
  end if;

  select slug into v_role_slug from public.roles where id = p_role_id;
  if v_role_slug is null then
    raise exception 'role not found';
  end if;

  -- Guard: don't allow the caller to remove their own admin.access
  -- if it would lock them out completely. (Soft check — they can
  -- still remove via SQL editor in case of mistake.)
  if p_target = v_caller and v_role_slug = 'headmaster' then
    raise exception 'cannot remove your own headmaster role from the UI; ask another headmaster or edit via SQL';
  end if;

  delete from public.user_roles
   where user_id = p_target
     and role_id = p_role_id;

  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    insert into public.entries (user_id, event_type, details)
    values (
      v_caller,
      'role_revoked',
      jsonb_build_object('role_slug', v_role_slug, 'target_user_id', p_target)
    );
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.admin_revoke_role(uuid, uuid) to authenticated;

-- ----------------------------------------------------------
-- admin_create_role(slug, name, description) → uuid
-- ----------------------------------------------------------
create or replace function public.admin_create_role(p_slug text, p_name text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_id     uuid;
  v_slug   text;
begin
  if not public.has_permission('roles.manage') then
    raise exception 'permission denied: roles.manage required';
  end if;

  v_slug := lower(trim(p_slug));
  if v_slug = '' then
    raise exception 'slug is required';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]*$' then
    raise exception 'slug must be lowercase letters, digits, and hyphens';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'name is required';
  end if;

  insert into public.roles (slug, name, description, is_system, created_by)
  values (v_slug, trim(p_name), nullif(trim(p_description), ''), false, v_caller)
  returning id into v_id;

  insert into public.entries (user_id, event_type, details)
  values (
    v_caller,
    'role_created',
    jsonb_build_object('slug', v_slug, 'name', p_name)
  );

  return v_id;
end;
$$;

grant execute on function public.admin_create_role(text, text, text) to authenticated;

-- ----------------------------------------------------------
-- admin_delete_role(role_id) → boolean
-- Guards: cannot delete is_system roles; cannot delete role with members.
-- ----------------------------------------------------------
create or replace function public.admin_delete_role(p_role_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller    uuid := auth.uid();
  v_slug      text;
  v_is_system boolean;
  v_members   int;
begin
  if not public.has_permission('roles.manage') then
    raise exception 'permission denied: roles.manage required';
  end if;

  select slug, is_system into v_slug, v_is_system
    from public.roles where id = p_role_id;

  if v_slug is null then
    raise exception 'role not found';
  end if;

  if v_is_system then
    raise exception 'cannot delete a system role (%)', v_slug;
  end if;

  select count(*) into v_members from public.user_roles where role_id = p_role_id;
  if v_members > 0 then
    raise exception 'role has % member(s); remove them first', v_members;
  end if;

  delete from public.roles where id = p_role_id;

  insert into public.entries (user_id, event_type, details)
  values (
    v_caller,
    'role_deleted',
    jsonb_build_object('slug', v_slug)
  );

  return true;
end;
$$;

grant execute on function public.admin_delete_role(uuid) to authenticated;

-- ----------------------------------------------------------
-- admin_update_role_permissions(role_id, permission_ids[]) → jsonb diff
-- Replaces the role's permission set with exactly the supplied ids.
-- ----------------------------------------------------------
create or replace function public.admin_update_role_permissions(p_role_id uuid, p_permission_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_slug     text;
  v_before   text[];
  v_after    text[];
  v_added    text[];
  v_removed  text[];
begin
  if not public.has_permission('roles.manage') then
    raise exception 'permission denied: roles.manage required';
  end if;

  select slug into v_slug from public.roles where id = p_role_id;
  if v_slug is null then
    raise exception 'role not found';
  end if;

  select coalesce(array_agg(p.slug order by p.slug), '{}')
    into v_before
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
   where rp.role_id = p_role_id;

  delete from public.role_permissions where role_id = p_role_id;

  if p_permission_ids is not null and array_length(p_permission_ids, 1) > 0 then
    insert into public.role_permissions (role_id, permission_id)
    select p_role_id, pid
      from unnest(p_permission_ids) as pid
     where exists (select 1 from public.permissions where id = pid);
  end if;

  select coalesce(array_agg(p.slug order by p.slug), '{}')
    into v_after
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
   where rp.role_id = p_role_id;

  v_added   := array(select unnest(v_after)  except select unnest(v_before));
  v_removed := array(select unnest(v_before) except select unnest(v_after));

  if array_length(v_added, 1) > 0 or array_length(v_removed, 1) > 0 then
    insert into public.entries (user_id, event_type, details)
    values (
      v_caller,
      'role_permissions_updated',
      jsonb_build_object(
        'role_slug', v_slug,
        'added',     to_jsonb(v_added),
        'removed',   to_jsonb(v_removed)
      )
    );
  end if;

  return jsonb_build_object(
    'role_slug', v_slug,
    'added',     to_jsonb(v_added),
    'removed',   to_jsonb(v_removed)
  );
end;
$$;

grant execute on function public.admin_update_role_permissions(uuid, uuid[]) to authenticated;

-- ----------------------------------------------------------
-- Convenience views for the admin UI.
-- ----------------------------------------------------------

-- Roles with member + permission counts.
drop view if exists public.roles_admin;
create view public.roles_admin as
  select
    r.id,
    r.slug,
    r.name,
    r.description,
    r.is_system,
    r.created_at,
    (select count(*) from public.user_roles ur where ur.role_id = r.id)        as member_count,
    (select count(*) from public.role_permissions rp where rp.role_id = r.id)  as permission_count
  from public.roles r
  order by r.is_system desc, r.name;

-- Users with their roles aggregated as a slug array.
drop view if exists public.users_admin;
create view public.users_admin as
  select
    p.user_id,
    p.character_name,
    p.role           as primary_role,
    p.server,
    p.created_at,
    p.rules_accepted_at,
    p.onboarding_completed_at,
    coalesce(
      (
        select array_agg(r.slug order by r.slug)
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
         where ur.user_id = p.user_id
      ),
      '{}'::text[]
    ) as role_slugs
  from public.profiles p
  order by p.created_at desc;
