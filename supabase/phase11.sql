-- ============================================================
-- Old Toby Academy — Phase 11 migration: rate limiting
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent.
-- ============================================================

create table if not exists public.rate_limits (
  id           bigserial primary key,
  ip           text not null,
  endpoint     text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists rate_limits_lookup_idx
  on public.rate_limits (ip, endpoint, attempted_at desc);

-- RLS — only headmaster reads; inserts go through the function below.
alter table public.rate_limits enable row level security;

drop policy if exists "headmaster reads rate_limits" on public.rate_limits;
create policy "headmaster reads rate_limits"
  on public.rate_limits for select
  using (public.has_permission('audit.read'));

-- ----------------------------------------------------------
-- record_rate_limit(ip, endpoint) → int
-- Inserts the attempt and returns the count of attempts in the
-- last 60 seconds for that (ip, endpoint) pair, including this one.
-- Callable by anon (login + redeem are pre-auth).
-- ----------------------------------------------------------
create or replace function public.record_rate_limit(p_ip text, p_endpoint text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits (ip, endpoint) values (p_ip, p_endpoint);
  select count(*) into v_count
    from public.rate_limits
   where ip = p_ip
     and endpoint = p_endpoint
     and attempted_at > now() - interval '60 seconds';
  return v_count;
end;
$$;

grant execute on function public.record_rate_limit(text, text) to anon, authenticated;

-- ----------------------------------------------------------
-- Convenience cleanup: delete entries older than a day.
-- Call manually when the table feels big, or set up pg_cron.
-- ----------------------------------------------------------
create or replace function public.purge_old_rate_limits()
returns int
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.rate_limits
     where attempted_at < now() - interval '1 day'
     returning 1
  )
  select count(*)::int from deleted;
$$;

grant execute on function public.purge_old_rate_limits() to authenticated;
