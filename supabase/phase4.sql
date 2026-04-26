-- ============================================================
-- Old Toby Academy — Phase 4 migration: student onboarding flow
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive only — does NOT drop existing tables or data.
-- Idempotent: re-runs cleanly.
-- ============================================================

-- ----------------------------------------------------------
-- profiles: new onboarding state + soft profile fields
-- ----------------------------------------------------------
alter table public.profiles
  add column if not exists rules_accepted_at        timestamptz,
  add column if not exists onboarding_completed_at  timestamptz,
  add column if not exists instrument               text,
  add column if not exists why_joining              text,
  add column if not exists experience               text;

-- Existing accounts (e.g. the headmaster) skip the new onboarding —
-- backfill them so middleware doesn't redirect them to /welcome.
update public.profiles
   set rules_accepted_at       = coalesce(rules_accepted_at, now()),
       onboarding_completed_at = coalesce(onboarding_completed_at, now())
 where rules_accepted_at is null;

-- ----------------------------------------------------------
-- invite_tokens: optional recipient note
-- ----------------------------------------------------------
alter table public.invite_tokens
  add column if not exists notes text;

-- Update the headmaster admin view so the table shows the note column.
create or replace view public.invite_tokens_admin as
  select
    token,
    role,
    notes,
    expires_at,
    used_at,
    used_by,
    created_at,
    case
      when used_at is not null then 'used'
      when expires_at is not null and expires_at <= now() then 'expired'
      else 'active'
    end as status
  from public.invite_tokens
  order by created_at desc;

-- ----------------------------------------------------------
-- audit log
-- ----------------------------------------------------------
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete set null,
  event_type  text not null,
  details     jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists entries_occurred_at_idx on public.entries (occurred_at desc);
create index if not exists entries_user_id_idx     on public.entries (user_id);
create index if not exists entries_event_type_idx  on public.entries (event_type);

alter table public.entries enable row level security;

drop policy if exists "headmaster reads entries" on public.entries;
create policy "headmaster reads entries"
  on public.entries for select using (public.is_headmaster());

drop policy if exists "self can insert entries" on public.entries;
create policy "self can insert entries"
  on public.entries for insert
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------
-- generate_invite_token now accepts a notes column.
-- ----------------------------------------------------------
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
begin
  if not public.is_headmaster() then
    raise exception 'only headmaster can generate tokens';
  end if;

  if p_role not in ('student', 'faculty') then
    raise exception 'role must be student or faculty';
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

-- ----------------------------------------------------------
-- redeem_token now also writes an audit-log entry on success.
-- Same signature as before (token, character, server) so callers
-- don't have to change.
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
  v_role   text;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'must be authenticated';
  end if;

  select role into v_role
    from public.invite_tokens
   where token = p_token
     and used_at is null
     and (expires_at is null or expires_at > now())
     for update;

  if v_role is null then
    raise exception 'invalid or expired token';
  end if;

  update public.invite_tokens
     set used_at = now(), used_by = v_caller
   where token = p_token;

  update public.profiles
     set role           = v_role,
         character_name = coalesce(p_character, character_name),
         server         = coalesce(p_server, server)
   where user_id = v_caller;

  -- Audit log row. SECURITY DEFINER bypasses RLS; auth.uid() is the new student.
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
