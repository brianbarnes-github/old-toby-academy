-- ============================================================
-- Old Toby Academy — Phase 7B fix: per-route permission lookup
-- Run once in Supabase SQL Editor → paste → RUN.
-- Additive + idempotent. Adds a helper that returns ALL of the
-- current user's permission slugs in one round-trip, so middleware
-- can apply per-route gating without N RPCs.
-- ============================================================

create or replace function public.current_user_permissions()
returns text[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(distinct p.slug), '{}'::text[])
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions       p on p.id       = rp.permission_id
   where ur.user_id = auth.uid();
$$;

grant execute on function public.current_user_permissions() to authenticated;
