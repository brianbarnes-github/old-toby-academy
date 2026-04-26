-- ============================================================
-- Old Toby Academy — Phase 12 migration: ops + security
-- foundation
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent.
--
-- Two pieces:
--   1) schema_migrations — a table that tracks which phaseN.sql files
--      have been applied. Phase 12 backfills every prior migration.
--      Going forward each new phase*.sql ends with a marker INSERT.
--
--   2) log_bot_block() — SECURITY DEFINER helper used by the new
--      honeypot check on /api/redeem-token. Lets unauthenticated
--      handlers append a 'bot_blocked' row to the audit log.
-- ============================================================

-- ----------------------------------------------------------
-- schema_migrations
-- ----------------------------------------------------------
create table if not exists public.schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);

alter table public.schema_migrations enable row level security;

drop policy if exists "headmaster reads migrations" on public.schema_migrations;
create policy "headmaster reads migrations"
  on public.schema_migrations for select
  using (public.has_permission('audit.read'));

-- Backfill — assume every prior migration has already been applied
-- (the running site proves it). Re-running this insert is harmless
-- thanks to ON CONFLICT.
insert into public.schema_migrations (filename, applied_at) values
  ('schema.sql',       '2026-01-01'),
  ('phase3.sql',       '2026-01-01'),
  ('phase4.sql',       '2026-01-01'),
  ('phase5.sql',       '2026-01-01'),
  ('phase6.sql',       '2026-01-01'),
  ('phase7.sql',       '2026-01-01'),
  ('phase7b.sql',      '2026-01-01'),
  ('phase7b-fix.sql',  '2026-01-01'),
  ('phase8.sql',       '2026-01-01'),
  ('phase10.sql',      '2026-01-01'),
  ('phase11.sql',      '2026-01-01')
on conflict (filename) do nothing;

-- ----------------------------------------------------------
-- log_bot_block(endpoint, ip) — anon-callable audit-log insert
-- ----------------------------------------------------------
create or replace function public.log_bot_block(p_endpoint text, p_ip text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.entries (user_id, event_type, details)
  values (
    null,
    'bot_blocked',
    jsonb_build_object('endpoint', p_endpoint, 'ip', p_ip)
  );
$$;

grant execute on function public.log_bot_block(text, text) to anon, authenticated;

-- ----------------------------------------------------------
-- Mark this migration applied
-- ----------------------------------------------------------
insert into public.schema_migrations (filename) values ('phase12.sql')
on conflict (filename) do nothing;
