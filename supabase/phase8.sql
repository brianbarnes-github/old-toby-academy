-- ============================================================
-- Old Toby Academy — Phase 8 migration: password reset
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent.
--
-- Adds a new ability `users.reset_password` and bundles it into
-- the headmaster role. The actual password-update operation
-- happens via the Supabase admin API (server-side, using the
-- service-role key) — Postgres only owns the permission check
-- and the audit-log record.
-- ============================================================

insert into public.permissions (slug, area, action, description, is_system)
values (
  'users.reset_password',
  'users',
  'reset_password',
  'Generate a temporary password for any member',
  true
)
on conflict (slug) do update
  set area        = excluded.area,
      action      = excluded.action,
      description = excluded.description,
      is_system   = excluded.is_system;

-- Bundle into headmaster
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r, public.permissions p
 where r.slug = 'headmaster'
   and p.slug = 'users.reset_password'
on conflict do nothing;
