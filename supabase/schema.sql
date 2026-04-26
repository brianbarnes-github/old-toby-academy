-- ============================================================
-- Old Toby Academy — initial schema (Phase 2)
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Idempotent: re-running drops and recreates the academy bits
-- without touching auth.users.
-- ============================================================

-- ----------------------------------------------------------
-- Tables
-- ----------------------------------------------------------

drop table if exists public.invite_tokens cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  user_id        uuid primary key references auth.users on delete cascade,
  role           text not null check (role in ('student', 'faculty', 'headmaster')) default 'student',
  character_name text,
  server         text,
  created_at     timestamptz not null default now()
);

create table public.invite_tokens (
  token        text primary key,
  role         text not null check (role in ('student', 'faculty')),
  expires_at   timestamptz,
  used_at      timestamptz,
  used_by      uuid references auth.users,
  created_by   uuid references auth.users not null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------
-- Auto-create a profile when a new auth user is created.
-- Default role: 'student'. Promote to faculty/headmaster via UPDATE.
-- ----------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------
-- Helper: am I a headmaster?
-- Used by RLS policies. SECURITY DEFINER bypasses RLS for the lookup.
-- ----------------------------------------------------------

create or replace function public.is_headmaster()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'headmaster'
  );
$$;

-- ----------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.invite_tokens enable row level security;

-- profiles: every signed-in user can read their own row.
create policy "self can read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- profiles: headmaster can read everyone.
create policy "headmaster reads all profiles"
  on public.profiles for select
  using (public.is_headmaster());

-- profiles: headmaster can update any profile (used to promote/demote).
create policy "headmaster updates any profile"
  on public.profiles for update
  using (public.is_headmaster())
  with check (public.is_headmaster());

-- profiles: users can update their own non-role fields.
-- (We don't let students change their own role; only headmaster can.)
create policy "self can update own profile (excl. role)"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and role = (select role from public.profiles where user_id = auth.uid()));

-- invite_tokens: only headmaster can do anything.
create policy "headmaster manages tokens"
  on public.invite_tokens for all
  using (public.is_headmaster())
  with check (public.is_headmaster());

-- ----------------------------------------------------------
-- redeem_token() — used in Phase 3 (signup flow)
-- Called as the new user (right after auth.signUp succeeds) to mark
-- their token consumed and set their role to whatever the token says.
-- Validates: token exists, not used, not expired.
-- ----------------------------------------------------------

create or replace function public.redeem_token(p_token text, p_character text default null, p_server text default null)
returns text  -- returns the role granted
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role        text;
  v_caller      uuid := auth.uid();
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
    set role = v_role,
        character_name = coalesce(p_character, character_name),
        server = coalesce(p_server, server)
    where user_id = v_caller;

  return v_role;
end;
$$;

-- Allow any authenticated user to call redeem_token (it's gated internally)
grant execute on function public.redeem_token(text, text, text) to authenticated;
