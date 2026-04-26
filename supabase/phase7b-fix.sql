-- ============================================================
-- Old Toby Academy — Phase 7B fix: per-route permission lookup
-- Run once in Supabase SQL Editor → paste → RUN.
-- Additive + idempotent. Adds two ways for the middleware to read
-- the current user's permissions in one round-trip.
-- ============================================================

-- Function form (kept for any caller that wants an array directly).
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

-- View form. Returning rows from a view is the most predictable shape
-- for the Supabase JS client: `[{slug: '...'}, {slug: '...'}]`.
create or replace view public.my_permissions as
  select distinct p.slug
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions       p on p.id       = rp.permission_id
   where ur.user_id = auth.uid();

grant select on public.my_permissions to authenticated;
